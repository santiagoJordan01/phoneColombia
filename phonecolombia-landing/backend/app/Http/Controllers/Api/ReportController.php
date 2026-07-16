<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\CashMovement;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\ServiceTicket;
use App\Models\User;
use App\Services\BySellerReportExporter;
use App\Services\CashRegisterReportExporter;
use App\Services\DailySalesReportExporter;
use App\Services\DailySettlementReportExporter;
use App\Services\InventoryIntakeReportExporter;
use App\Services\ReceivablesReportExporter;
use App\Services\RemissionSalesReportExporter;
use App\Services\ServiceTicketsReportExporter;
use App\Support\InventoryStatus;
use App\Support\MoneyFormatter;
use App\Support\PaymentMethods;
use App\Support\ReportPeriod;
use App\Support\SaleCostResolver;
use App\Support\SaleReservationStatus;
use App\Support\ServiceTicketAccess;
use App\Support\ServiceTicketStateCatalog;
use App\Support\ServiceTicketType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use ScopesInventoryForUser;

    public function __construct(
        private DailySalesReportExporter $dailyExporter,
        private BySellerReportExporter $bySellerExporter,
        private CashRegisterReportExporter $cashExporter,
        private DailySettlementReportExporter $dailySettlementExporter,
        private ReceivablesReportExporter $receivablesExporter,
        private RemissionSalesReportExporter $remissionSalesExporter,
        private InventoryIntakeReportExporter $inventoryIntakeExporter,
        private ServiceTicketsReportExporter $serviceTicketsExporter,
    ) {}

    public function daily(Request $request): JsonResponse
    {
        [, , , , $report] = $this->resolveDailyReport($request);

        return response()->json($report);
    }

    public function exportDailyPdf(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveDailyReportForExport($request);

        return $this->dailyExporter->toPdf($report, $label);
    }

    public function exportDailyExcel(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveDailyReportForExport($request);

        return $this->dailyExporter->toExcel($report, $label);
    }

    public function exportBySellerPdf(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveBySellerReportForExport($request);

        return $this->bySellerExporter->toPdf($report, $label);
    }

    public function exportBySellerExcel(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveBySellerReportForExport($request);

        return $this->bySellerExporter->toExcel($report, $label);
    }

    public function exportCashRegisterPdf(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveCashRegisterReportForExport($request);

        return $this->cashExporter->toPdf($report, $label);
    }

    public function exportCashRegisterExcel(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveCashRegisterReportForExport($request);

        return $this->cashExporter->toExcel($report, $label);
    }

    public function exportReceivablesPdf(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveReceivablesReportForExport($request);

        return $this->receivablesExporter->toPdf($report, $label);
    }

    public function exportReceivablesExcel(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveReceivablesReportForExport($request);

        return $this->receivablesExporter->toExcel($report, $label);
    }

    public function exportByRemissionXls(Request $request): StreamedResponse
    {
        [$from, $to, $sales] = $this->resolveByRemissionSales($request);

        $label = $from->isSameDay($to)
            ? $to->format('Y-m-d')
            : $from->format('Y-m-d').'_'.$to->format('Y-m-d');

        return $this->remissionSalesExporter->toXls($sales, $label);
    }

    public function exportByRemissionPdf(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveByRemissionReportForExport($request);

        return $this->remissionSalesExporter->toPdf($report, $label);
    }

    public function monthly(Request $request): JsonResponse
    {
        $user = $this->authorizeReports($request);
        $now = now(ReportPeriod::TIMEZONE);
        $year = (int) ($request->input('year') ?? $now->year);
        $month = (int) ($request->input('month') ?? $now->month);
        [$start, $end] = ReportPeriod::monthBounds($year, $month);

        $sales = $this->reportSalesQuery($user, $request)
            ->whereBetween('sold_at', [$start, $end])
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer', 'creditPaymentMethod'])
            ->get();

        $inventoryQuery = InventoryItem::query();
        $inventoryQuery = $this->scopeInventoryForUser($inventoryQuery, $user);
        $available = (clone $inventoryQuery)->where('status', InventoryStatus::DISPONIBLE)->count();
        $soldInMonth = $sales->count();

        $report = $this->buildSalesReport($sales, $start->format('Y-m'), 'monthly', $start, $end);
        $report['inventory_available'] = $available;
        $report['units_sold'] = $soldInMonth;

        $prevStart = $start->copy()->subMonth();
        $prevEnd = $prevStart->copy()->endOfMonth();
        $prevMonthSales = $this->reportSalesQuery($user, $request)
            ->whereBetween('sold_at', [$prevStart, $prevEnd])
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer', 'creditPaymentMethod'])
            ->get();
        $prevTotals = $this->buildSalesReport($prevMonthSales, $prevStart->format('Y-m'), 'monthly', $prevStart, $prevEnd)['totals'];
        $currentRevenue = (float) ($report['totals']['revenue'] ?? 0);
        $previousRevenue = (float) ($prevTotals['revenue'] ?? 0);
        $report['comparison'] = [
            'previous_month_revenue' => $previousRevenue,
            'current_month_revenue' => $currentRevenue,
            'previous_month_profit' => (float) ($prevTotals['profit'] ?? 0),
            'current_month_profit' => (float) ($report['totals']['profit'] ?? 0),
            'change_percent' => $previousRevenue > 0
                ? round((($currentRevenue - $previousRevenue) / $previousRevenue) * 100, 1)
                : null,
        ];

        return response()->json($report);
    }

    public function bySeller(Request $request): JsonResponse
    {
        [, , , $report] = $this->resolveBySellerReport($request);

        return response()->json($report);
    }

    public function cashRegister(Request $request): JsonResponse
    {
        return response()->json($this->resolveCashRegisterReport($request));
    }

    public function dailySettlement(Request $request): JsonResponse
    {
        return response()->json($this->resolveDailySettlementReport($request));
    }

    public function exportDailySettlementPdf(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveDailySettlementReportForExport($request);

        return $this->dailySettlementExporter->toPdf($report, $label);
    }

    public function exportDailySettlementExcel(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveDailySettlementReportForExport($request);

        return $this->dailySettlementExporter->toExcel($report, $label);
    }

    public function inventoryIntake(Request $request): JsonResponse
    {
        return response()->json($this->resolveInventoryIntakeReport($request));
    }

    public function exportInventoryIntakePdf(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveInventoryIntakeReportForExport($request);

        return $this->inventoryIntakeExporter->toPdf($report, $label);
    }

    public function exportInventoryIntakeExcel(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveInventoryIntakeReportForExport($request);

        return $this->inventoryIntakeExporter->toExcel($report, $label);
    }

    public function serviceTickets(Request $request): JsonResponse
    {
        return response()->json($this->resolveServiceTicketsReport($request));
    }

    public function exportServiceTicketsPdf(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveServiceTicketsReportForExport($request);

        return $this->serviceTicketsExporter->toPdf($report, $label);
    }

    public function exportServiceTicketsExcel(Request $request): StreamedResponse
    {
        [$label, $report] = $this->resolveServiceTicketsReportForExport($request);

        return $this->serviceTicketsExporter->toExcel($report, $label);
    }

    /** @return array<string, mixed> */
    private function resolveCashRegisterReport(Request $request): array
    {
        $user = $this->authorizeReports($request);
        [$periodStart, $periodEnd, $from, $to] = ReportPeriod::resolve($request);

        $salesQuery = $this->reportSalesQuery($user, $request);
        $allSalesQuery = $this->applySalesFilters($this->scopedSales($user), $request);
        $sales = (clone $salesQuery)
            ->whereBetween('sold_at', [$periodStart, $periodEnd])
            ->get();

        $periodSaleIds = $sales->pluck('id')->all();
        $scopedSaleIds = (clone $allSalesQuery)->pluck('id');

        $paymentsInPeriod = SalePayment::query()
            ->whereIn('sale_id', $scopedSaleIds)
            ->whereBetween('paid_at', [$periodStart, $periodEnd])
            ->with(['sale.inventoryItem', 'sale.user', 'sale.serviceCustomer', 'sale.creditPaymentMethod'])
            ->orderBy('paid_at')
            ->get();

        $paymentsOnPeriodSales = $paymentsInPeriod->whereIn('sale_id', $periodSaleIds);
        $paymentsOnOtherSales = $paymentsInPeriod->whereNotIn('sale_id', $periodSaleIds);

        $retakeOutflows = (clone $allSalesQuery)
            ->whereNotNull('returned_at')
            ->whereBetween('returned_at', [$periodStart, $periodEnd])
            ->with(['inventoryItem', 'user'])
            ->orderBy('returned_at')
            ->get();

        $retakeLedger = $retakeOutflows
            ->map(fn (Sale $sale) => $this->mapRetakeOutflow($sale))
            ->values();

        $ledger = $paymentsInPeriod
            ->map(fn (SalePayment $payment) => $this->mapLedgerPayment($payment, $periodSaleIds))
            ->concat($retakeLedger)
            ->sortBy('paid_at')
            ->values()
            ->map(function (array $line) {
                $paidAt = $line['paid_at'] ?? null;
                if ($paidAt instanceof \DateTimeInterface) {
                    $line['paid_at'] = $paidAt->format('Y-m-d H:i:s');
                }

                return $line;
            })
            ->values()
            ->all();

        $byType = [];
        foreach ($ledger as $line) {
            $type = $line['type'];
            $byType[$type] = round(($byType[$type] ?? 0) + (float) $line['amount'], 2);
        }

        $byMethod = $paymentsInPeriod
            ->groupBy('method')
            ->map(fn ($group) => round((float) $group->sum('amount'), 2))
            ->all();
        foreach ($retakeLedger as $line) {
            $method = $line['method'];
            $byMethod[$method] = round(($byMethod[$method] ?? 0) + (float) $line['amount'], 2);
        }

        $cashCollected = round((float) $paymentsInPeriod->sum('amount') + (float) $retakeLedger->sum('amount'), 2);
        $retakeOutflowsTotal = round(abs((float) $retakeLedger->sum('amount')), 2);
        $collectionsOnPeriodSales = round((float) $paymentsOnPeriodSales->sum('amount'), 2);
        $collectionsOnOtherSales = round((float) $paymentsOnOtherSales->sum('amount'), 2);

        $expected = round($sales->sum(fn ($s) => MoneyFormatter::parse($s->sale_price)), 2);
        $salesCollected = round((float) $sales->sum('amount_paid'), 2);
        $pending = round((float) $sales->sum('amount_due'), 2);
        $totalCost = round($sales->sum(fn (Sale $s) => SaleCostResolver::purchasePriceAtSale($s)), 2);
        $totalProfit = round($sales->sum(fn (Sale $s) => SaleCostResolver::netProfit($s)), 2);

        return [
            'type' => 'cash_register',
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'is_range' => ! $from->isSameDay($to),
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'sales_count' => $sales->count(),
            'by_payment_method' => $byMethod,
            'by_collection_type' => $byType,
            'ledger' => $ledger,
            'total_collected' => $cashCollected,
            'cash_collected_in_period' => $cashCollected,
            'collections_on_period_sales' => $collectionsOnPeriodSales,
            'collections_on_other_sales' => $collectionsOnOtherSales,
            'total_expected' => $expected,
            'total_cost' => $totalCost,
            'total_profit' => $totalProfit,
            'margin_percent' => $expected > 0 ? round(($totalProfit / $expected) * 100, 1) : null,
            'sales_collected_status' => $salesCollected,
            'pending_credits' => $pending,
            'retake_outflows' => $retakeOutflowsTotal,
            'difference' => round($expected - $salesCollected - $pending, 2),
            'methodology' => 'Cobros según fecha de pago. Las retomas del período se registran como egresos. Las ventas devueltas no entran en ingresos ni pendientes del cuadre. Utilidad bruta = ingresos de ventas del período − costo congelado al momento de cada venta.',
        ];
    }

    /** @return array{0: string, 1: array<string, mixed>} */
    private function resolveCashRegisterReportForExport(Request $request): array
    {
        $report = $this->resolveCashRegisterReport($request);
        $from = $report['period_from'];
        $to = $report['period_to'];
        $label = $from === $to ? $to : $from.'_'.$to;

        return [$label, $report];
    }

    /** @return array<string, mixed> */
    private function resolveDailySettlementReport(Request $request): array
    {
        $user = $this->authorizeReports($request);
        [$periodStart, $periodEnd, $from, $to] = ReportPeriod::resolve($request);

        // Capa comercial: ventas cerradas en el período (devengo).
        $sales = $this->reportSalesQuery($user, $request)
            ->whereBetween('sold_at', [$periodStart, $periodEnd])
            ->with(['inventoryItem.supplierRelation', 'user', 'payments', 'creditPaymentMethod', 'serviceCustomer'])
            ->orderBy('sold_at')
            ->get();

        $periodSaleIds = $sales->pluck('id')->all();
        $scopedSaleIds = $this->applySalesFilters($this->scopedSales($user), $request)->pluck('id');

        // Capa de caja: dinero que entró/salió en el período (caja).
        $paymentsInPeriod = SalePayment::query()
            ->whereIn('sale_id', $scopedSaleIds)
            ->whereBetween('paid_at', [$periodStart, $periodEnd])
            ->with(['sale.inventoryItem', 'sale.user', 'sale.creditPaymentMethod', 'user'])
            ->orderBy('paid_at')
            ->get();

        $manualMovements = CashMovement::query()
            ->with('user:id,name')
            ->whereBetween('occurred_at', [$periodStart, $periodEnd])
            ->orderBy('occurred_at')
            ->get();

        $retakes = $this->applySalesFilters($this->scopedSales($user), $request)
            ->whereNotNull('returned_at')
            ->whereBetween('returned_at', [$periodStart, $periodEnd])
            ->with(['inventoryItem', 'user'])
            ->orderBy('returned_at')
            ->get();

        $buckets = [];
        $addBucket = function (string $key, string $label, float $amount) use (&$buckets): void {
            if ($amount == 0.0) {
                return;
            }
            if (! isset($buckets[$key])) {
                $buckets[$key] = ['key' => $key, 'label' => $label, 'amount' => 0.0];
            }
            $buckets[$key]['amount'] = round($buckets[$key]['amount'] + $amount, 2);
        };

        $bucketForImmediate = function (string $method): string {
            return match ($method) {
                PaymentMethods::EFECTIVO => 'efectivo',
                PaymentMethods::TARJETA => 'datafono',
                PaymentMethods::TRANSFERENCIA,
                PaymentMethods::NEQUI,
                PaymentMethods::DAVIPLATA,
                PaymentMethods::BANCOLOMBIA => 'transferencia',
                default => 'otros',
            };
        };

        $immediateLabels = [
            'efectivo' => 'Efectivo',
            'transferencia' => 'Transferencia',
            'datafono' => 'Datáfono',
            'otros' => 'Otros',
        ];

        // Formas de pago = cobros reales del período (fecha de pago), no cartera.
        foreach ($paymentsInPeriod as $payment) {
            $method = (string) $payment->method;
            $key = $bucketForImmediate($method);
            $addBucket($key, $immediateLabels[$key] ?? PaymentMethods::label($method), (float) $payment->amount);
        }

        foreach ($manualMovements->where('type', CashMovement::TYPE_INGRESO) as $movement) {
            $method = (string) $movement->method;
            $key = $bucketForImmediate($method);
            $addBucket($key, $immediateLabels[$key] ?? PaymentMethods::label($method), (float) $movement->amount);
        }

        // Crédito/financiación abierta en ventas del día (no es ingreso de caja).
        $creditoDelDia = 0.0;
        foreach ($sales as $sale) {
            $due = (float) $sale->amount_due;
            if ($due <= 0) {
                continue;
            }
            $creditName = $sale->creditPaymentMethod?->name ?: 'Crédito';
            $creditKey = 'credito_'.($sale->creditPaymentMethod?->slug ?: 'general');
            $addBucket($creditKey, $creditName, $due);
            $creditoDelDia += $due;
        }
        $creditoDelDia = round($creditoDelDia, 2);

        $preferredOrder = ['efectivo', 'transferencia', 'datafono'];
        $formas = [];
        foreach ($preferredOrder as $key) {
            if (isset($buckets[$key])) {
                $formas[] = $buckets[$key];
                unset($buckets[$key]);
            } else {
                $formas[] = ['key' => $key, 'label' => $immediateLabels[$key], 'amount' => 0.0];
            }
        }

        $creditDefaults = [
            ['key' => 'credito_addi', 'label' => 'Crédito Addi'],
            ['key' => 'credito_sistecredito', 'label' => 'Sistecredito'],
            ['key' => 'credito_banco_de_bogota', 'label' => 'Banco de Bogotá'],
            ['key' => 'credito_gora', 'label' => 'Gora'],
        ];
        foreach ($creditDefaults as $credit) {
            $key = $credit['key'];
            if (isset($buckets[$key])) {
                $formas[] = [
                    'key' => $key,
                    'label' => $credit['label'],
                    'amount' => $buckets[$key]['amount'],
                ];
                unset($buckets[$key]);
            } else {
                $formas[] = ['key' => $key, 'label' => $credit['label'], 'amount' => 0.0];
            }
        }

        foreach ($buckets as $bucket) {
            $formas[] = $bucket;
        }

        $totalFormasCaja = round(collect($formas)
            ->filter(fn (array $f) => ! str_starts_with((string) ($f['key'] ?? ''), 'credito_'))
            ->sum('amount'), 2);
        $totalFormas = round(collect($formas)->sum('amount'), 2);
        $ventasNetas = round($sales->sum(fn (Sale $s) => MoneyFormatter::parse($s->sale_price)), 2);
        $totalCosto = round($sales->sum(fn (Sale $s) => SaleCostResolver::purchasePriceAtSale($s)), 2);
        $utilidadBruta = round($ventasNetas - $totalCosto, 2);

        $paymentsBySaleInPeriod = $paymentsInPeriod->groupBy('sale_id');

        $equipos = $sales->map(function (Sale $sale) use ($paymentsBySaleInPeriod) {
            $item = $sale->inventoryItem;
            $cobradoHoy = round((float) ($paymentsBySaleInPeriod->get($sale->id)?->sum('amount') ?? 0), 2);
            $valor = MoneyFormatter::parse($sale->sale_price);
            $costo = SaleCostResolver::purchasePriceAtSale($sale);

            return [
                'id' => $sale->id,
                'remission_number' => $sale->remission_number,
                'sold_at' => $sale->sold_at?->format('Y-m-d H:i:s'),
                'origen' => 'venta',
                'origen_label' => 'Venta',
                'equipo' => $item?->name ?? '—',
                'imei' => $item?->imei,
                'proveedor' => $item?->supplierRelation?->name ?? $item?->supplier,
                'valor' => $valor,
                'costo' => $costo,
                'utilidad' => round($valor - $costo, 2),
                'egreso' => 0.0,
                'ingreso' => $cobradoHoy,
                'cobrado_acumulado' => (float) $sale->amount_paid,
                'pendiente' => (float) $sale->amount_due,
                'responsable' => $sale->user?->name,
                'payment_method' => $sale->payment_method,
                'credit_payment_method' => $sale->creditPaymentMethod?->name,
            ];
        })->values()->all();

        $movimientos = [];

        foreach ($paymentsInPeriod as $payment) {
            $sale = $payment->sale;
            $classification = $this->classifyCollectionType($sale, $payment);
            $itemName = $sale?->inventoryItem?->name;
            $movimientos[] = [
                'id' => 'cobro-'.$payment->id,
                'sale_id' => $sale?->id,
                'origen' => $classification['type'] === 'apartado' ? 'apartado' : ($classification['type'] === 'abono' ? 'abono' : 'venta'),
                'origen_label' => $classification['label'],
                'type' => CashMovement::TYPE_INGRESO,
                'type_label' => 'Ingreso',
                'concept' => $itemName ?: ($classification['label']),
                'method' => $payment->method,
                'method_label' => PaymentMethods::label((string) $payment->method),
                'costo' => $sale ? SaleCostResolver::purchasePriceAtSale($sale) : null,
                'amount' => (float) $payment->amount,
                'occurred_at' => $payment->paid_at?->format('Y-m-d H:i:s'),
                'responsable' => $payment->user?->name ?? $sale?->user?->name,
                'notes' => $sale?->remission_number
                    ? trim(($payment->notes ? $payment->notes.' · ' : '').'Remisión '.$sale->remission_number)
                    : $payment->notes,
                'on_period_sale' => in_array($payment->sale_id, $periodSaleIds, true),
            ];
        }

        foreach ($retakes as $sale) {
            $amount = round(MoneyFormatter::parse($sale->retake_price ?? '0'), 2);
            if ($amount <= 0) {
                continue;
            }
            $item = $sale->inventoryItem;
            $method = (string) ($sale->retake_payment_method ?: PaymentMethods::EFECTIVO);
            $movimientos[] = [
                'id' => 'retoma-'.$sale->id,
                'sale_id' => $sale->id,
                'origen' => 'retoma',
                'origen_label' => 'Retoma',
                'type' => CashMovement::TYPE_EGRESO,
                'type_label' => 'Egreso',
                'concept' => $item?->name ?? 'Retoma',
                'method' => $method,
                'method_label' => PaymentMethods::label($method),
                'costo' => SaleCostResolver::purchasePriceAtSale($sale),
                'amount' => $amount,
                'occurred_at' => $sale->returned_at?->format('Y-m-d H:i:s'),
                'responsable' => $sale->user?->name,
                'notes' => $sale->remission_number ? 'Remisión '.$sale->remission_number : null,
                'on_period_sale' => false,
            ];
        }

        foreach ($manualMovements as $movement) {
            $movimientos[] = [
                'id' => $movement->id,
                'sale_id' => null,
                'origen' => 'manual',
                'origen_label' => 'Manual',
                'type' => $movement->type,
                'type_label' => CashMovement::typeLabel((string) $movement->type),
                'concept' => $movement->concept ?: ($movement->isIngreso() ? 'Ingreso de caja' : 'Egreso de caja'),
                'method' => $movement->method,
                'method_label' => PaymentMethods::label((string) $movement->method),
                'costo' => null,
                'amount' => (float) $movement->amount,
                'occurred_at' => $movement->occurred_at?->format('Y-m-d H:i:s'),
                'responsable' => $movement->user?->name,
                'notes' => $movement->notes,
                'on_period_sale' => false,
            ];
        }

        usort($movimientos, function (array $a, array $b) {
            return strcmp((string) ($a['occurred_at'] ?? ''), (string) ($b['occurred_at'] ?? ''));
        });

        $movimientosCostoTotal = round((float) collect($movimientos)
            ->filter(fn (array $m) => ($m['sale_id'] ?? null) && ($m['costo'] ?? null) !== null)
            ->unique('sale_id')
            ->sum('costo'), 2);

        $ingresosCobros = round((float) $paymentsInPeriod->sum('amount'), 2);
        $ingresosManuales = round((float) $manualMovements->where('type', CashMovement::TYPE_INGRESO)->sum('amount'), 2);
        $egresosRetoma = round((float) $retakes->sum(fn (Sale $s) => MoneyFormatter::parse($s->retake_price ?? '0')), 2);
        $egresosManuales = round((float) $manualMovements->where('type', CashMovement::TYPE_EGRESO)->sum('amount'), 2);

        $totalIngresos = round($ingresosCobros + $ingresosManuales, 2);
        $totalEgresos = round($egresosRetoma + $egresosManuales, 2);
        $netoCaja = round($totalIngresos - $totalEgresos, 2);

        // Cuadre comercial de consistencia: cada venta debe explicar precio = cobrado acumulado + pendiente.
        $cobradoVentasDelDia = round((float) $paymentsInPeriod->whereIn('sale_id', $periodSaleIds)->sum('amount'), 2);
        $cobradoAcumuladoVentas = round((float) $sales->sum(fn (Sale $s) => (float) $s->amount_paid), 2);
        $pendienteVentas = round((float) $sales->sum(fn (Sale $s) => (float) $s->amount_due), 2);
        $diferenciaVentas = round($ventasNetas - $cobradoAcumuladoVentas - $pendienteVentas, 2);

        return [
            'type' => 'daily_settlement',
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'is_range' => ! $from->isSameDay($to),
            'fecha' => $from->isSameDay($to) ? $from->toDateString() : $from->toDateString().' — '.$to->toDateString(),
            'ventas_netas' => $ventasNetas,
            'total_costo' => $totalCosto,
            'utilidad_bruta' => $utilidadBruta,
            'formas_de_pago' => $formas,
            'total_formas_pago' => $totalFormas,
            'total_formas_caja' => $totalFormasCaja,
            'credito_del_dia' => $creditoDelDia,
            'cobrado_ventas_del_dia' => $cobradoVentasDelDia,
            'cobrado_acumulado_ventas' => $cobradoAcumuladoVentas,
            'pendiente_ventas' => $pendienteVentas,
            'diferencia' => $diferenciaVentas,
            'neto_caja' => $netoCaja,
            'total_ingresos' => $totalIngresos,
            'total_egresos' => $totalEgresos,
            'ingresos_venta' => $ingresosCobros,
            'ingresos_cobros' => $ingresosCobros,
            'ingresos_manuales' => $ingresosManuales,
            'egresos_retoma' => $egresosRetoma,
            'egresos_manuales' => $egresosManuales,
            'equipos_vendidos' => $equipos,
            'equipos_count' => count($equipos),
            'movimientos_caja' => $movimientos,
            'movimientos_count' => count($movimientos),
            'movimientos_costo_total' => $movimientosCostoTotal,
            'methodology' => 'Contable: ventas netas = ventas cerradas del período (fecha de venta). Costo = precio de compra congelado al momento de cada venta. Utilidad bruta = ventas netas − costo. Ingresos/egresos de caja = cobros (fecha de pago), retomas y movimientos manuales del período. Crédito del día = saldo pendiente de esas ventas (no es caja). Neto de caja = ingresos − egresos. Diferencia ventas = ventas netas − cobrado acumulado − pendiente (debe ser 0 si los datos son consistentes).',
        ];
    }

    /** @return array{0: string, 1: array<string, mixed>} */
    private function resolveDailySettlementReportForExport(Request $request): array
    {
        $report = $this->resolveDailySettlementReport($request);
        $from = $report['period_from'];
        $to = $report['period_to'];
        $label = $from === $to ? $to : $from.'_'.$to;

        return [$label, $report];
    }

    public function receivables(Request $request): JsonResponse
    {
        return response()->json($this->resolveReceivablesReport($request));
    }

    /** @return array<string, mixed> */
    private function resolveReceivablesReport(Request $request): array
    {
        $user = $this->authorizeReports($request);

        $sales = $this->applySalesFilters($this->scopedSales($user), $request)
            ->where('amount_due', '>', 0)
            ->whereNull('returned_at')
            ->where(function ($query) {
                $query->where('credit_status', 'pending')
                    ->orWhere('reservation_status', SaleReservationStatus::ACTIVE);
            })
            ->with(['inventoryItem', 'user', 'serviceCustomer', 'creditPaymentMethod'])
            ->orderByRaw('COALESCE(credit_due_at, reserved_at, created_at) ASC')
            ->get();

        $rows = $sales->map(function (Sale $sale) {
            $row = $this->mapReceivableRow($sale);
            foreach (['due_at', 'sold_at', 'reserved_at'] as $key) {
                $value = $row[$key] ?? null;
                if ($value instanceof \DateTimeInterface) {
                    $row[$key] = $value->format('Y-m-d H:i:s');
                }
            }

            return $row;
        })->values();

        $apartados = $rows->where('type', 'apartado');
        $creditos = $rows->where('type', 'credito');
        $revenue = round((float) $rows->sum('sale_price'), 2);
        $totalCost = round((float) $rows->sum('purchase_price_num'), 2);
        $totalProfit = round((float) $rows->sum('net_profit'), 2);

        return [
            'type' => 'receivables',
            'as_of' => now()->timezone('America/Bogota')->format('Y-m-d H:i:s'),
            'items' => $rows->values()->all(),
            'totals' => [
                'count' => $rows->count(),
                'apartados_count' => $apartados->count(),
                'creditos_count' => $creditos->count(),
                'total_due' => round((float) $rows->sum('amount_due'), 2),
                'total_paid' => round((float) $rows->sum('amount_paid'), 2),
                'revenue' => $revenue,
                'total_cost' => $totalCost,
                'total_profit' => $totalProfit,
                'margin_percent' => $revenue > 0 ? round(($totalProfit / $revenue) * 100, 1) : null,
                'apartados_due' => round((float) $apartados->sum('amount_due'), 2),
                'creditos_due' => round((float) $creditos->sum('amount_due'), 2),
                'overdue_count' => $rows->where('is_overdue', true)->count(),
                'overdue_amount' => round((float) $rows->where('is_overdue', true)->sum('amount_due'), 2),
            ],
            'methodology' => 'Saldo pendiente por cobrar en apartados activos y ventas a crédito. Vencido = fecha límite de crédito ya pasada. Utilidad bruta = precio de venta − costo congelado de cada cuenta pendiente.',
        ];
    }

    /** @return array{0: string, 1: array<string, mixed>} */
    private function resolveReceivablesReportForExport(Request $request): array
    {
        $report = $this->resolveReceivablesReport($request);
        $label = now()->timezone('America/Bogota')->format('Y-m-d');

        return [$label, $report];
    }

    public function exportInventory(Request $request): StreamedResponse
    {
        $user = $request->user();
        if (! $user->canManageInventory()) {
            abort(403);
        }

        $query = InventoryItem::query()->with('supplierRelation');
        $query = $this->scopeInventoryForUser($query, $user);

        $filename = 'inventario_'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Código barras', 'IMEI', 'Equipo', 'Color', 'Proveedor', 'Precio compra', 'Precio venta', 'Batería', 'Estado', 'Fecha ingreso', 'Notas']);
            $query->orderBy('name')->chunk(200, function ($items) use ($out) {
                foreach ($items as $item) {
                    fputcsv($out, [
                        $item->barcode,
                        $item->imei,
                        $item->name,
                        $item->color,
                        $item->supplier,
                        $item->purchase_price,
                        $item->sale_price,
                        $item->battery,
                        $item->status,
                        $item->acquired_at?->toDateString() ?? $item->created_at?->toDateString(),
                        $item->notes,
                    ]);
                }
            });
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function exportSales(Request $request): StreamedResponse
    {
        $user = $this->authorizeReports($request);
        [$periodStart, $periodEnd, $from, $to] = ReportPeriod::resolveMonthToDate($request);

        $sales = $this->reportSalesQuery($user, $request)
            ->whereBetween('sold_at', [$periodStart, $periodEnd])
            ->with(['inventoryItem', 'user', 'creditPaymentMethod'])
            ->orderBy('sold_at')
            ->get();

        $filename = 'ventas_'.$from->format('Y-m-d').'_'.$to->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($sales) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Fecha', 'Remisión', 'Equipo', 'IMEI', 'Precio venta', 'Costo', 'Utilidad', 'Método', 'Pagado', 'Pendiente', 'Cliente', 'Vendedor']);
            foreach ($sales as $sale) {
                $row = $this->mapSaleRow($sale);
                fputcsv($out, [
                    $sale->sold_at?->toDateTimeString(),
                    $sale->remission_number,
                    $sale->inventoryItem?->name,
                    $sale->inventoryItem?->imei,
                    MoneyFormatter::format($row['sale_price_num']),
                    MoneyFormatter::format($row['purchase_price_num']),
                    MoneyFormatter::format($row['net_profit']),
                    $sale->payment_method,
                    MoneyFormatter::format($row['amount_paid']),
                    MoneyFormatter::format($row['amount_due']),
                    $sale->customer_name,
                    $sale->user?->name,
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function authorizeReports(Request $request)
    {
        $user = $request->user();
        if (! $user->canViewReports()) {
            abort(403, 'No tienes permiso para ver informes.');
        }

        return $user;
    }

    private function scopedSales($user)
    {
        $query = Sale::query();
        if ($user->isSupplier() && $user->supplier_id) {
            $query->whereHas('inventoryItem', fn ($q) => $q->where('supplier_id', $user->supplier_id));
        }

        return $query;
    }

    private function reportSalesQuery($user, Request $request)
    {
        return $this->applySalesFilters($this->scopedSales($user), $request)
            ->whereNull('returned_at');
    }

    private function applySalesFilters($query, Request $request)
    {
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }
        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->string('payment_method'));
        }
        if ($request->filled('credit_status')) {
            $query->where('credit_status', $request->string('credit_status'));
        }
        if ($request->filled('supplier_id')) {
            $query->whereHas('inventoryItem', fn ($q) => $q->where('supplier_id', $request->string('supplier_id')));
        }
        if ($request->filled('inventory_product_id')) {
            $query->whereHas('inventoryItem', fn ($q) => $q->where('inventory_product_id', $request->string('inventory_product_id')));
        }
        if ($this->requestHasInventoryAttributeFilters($request)) {
            $query->whereHas('inventoryItem', function ($itemQuery) use ($request) {
                $this->applyInventoryAttributeFilters($itemQuery, $request);
            });
        }
        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('remission_number', 'like', $term)
                    ->orWhere('customer_name', 'like', $term)
                    ->orWhereHas('inventoryItem', fn ($itemQuery) => $itemQuery
                        ->where('name', 'like', $term)
                        ->orWhere('imei', 'like', $term)
                        ->orWhere('barcode', 'like', $term));
            });
        }

        return $query;
    }

    private function requestHasInventoryAttributeFilters(Request $request): bool
    {
        return $request->filled('brand')
            || $request->filled('model')
            || $request->filled('storage')
            || $request->filled('color')
            || $request->filled('battery')
            || $request->filled('battery_status');
    }

    /** @param  \Illuminate\Database\Eloquent\Builder<\App\Models\InventoryItem>  $query */
    private function applyInventoryAttributeFilters($query, Request $request): void
    {
        if ($request->filled('brand')) {
            $brand = strtoupper(trim((string) $request->string('brand')));
            $query->where(function ($q) use ($brand) {
                $q->whereHas('inventoryProduct', fn ($p) => $p->where('brand', $brand))
                    ->orWhere('name', 'like', $brand.'%');
            });
        }

        if ($request->filled('model')) {
            $model = strtoupper(trim((string) $request->string('model')));
            $query->where(function ($q) use ($model) {
                $q->whereHas('inventoryProduct', fn ($p) => $p->where('model', $model))
                    ->orWhere('name', 'like', '%'.$model.'%');
            });
        }

        if ($request->filled('storage')) {
            $storage = strtoupper(trim((string) $request->string('storage')));
            $query->where(function ($q) use ($storage) {
                $q->where('storage', $storage)
                    ->orWhereHas('inventoryProduct', fn ($p) => $p->where('storage', $storage))
                    ->orWhere('name', 'like', '%'.$storage.'%');
            });
        }

        if ($request->filled('color')) {
            $query->where('color', trim((string) $request->string('color')));
        }

        if ($request->filled('battery') && is_numeric((string) $request->input('battery'))) {
            $battery = (int) $request->input('battery');
            if ($battery >= 0 && $battery <= 100) {
                $query->where('battery', $battery);
            }
        } elseif ($request->filled('battery_status')) {
            $status = (string) $request->string('battery_status');
            if ($status === 'ok') {
                $query->where('battery', '>=', 85);
            } elseif ($status === 'baja') {
                $query->whereNotNull('battery')->where('battery', '<', 85);
            } elseif ($status === 'sin_dato') {
                $query->whereNull('battery');
            }
        }
    }

    public function byRemission(Request $request): JsonResponse
    {
        [$from, $to, $sales] = $this->resolveByRemissionSales($request);

        return response()->json($this->buildByRemissionReport($from, $to, $sales));
    }

    /** @return array<string, mixed> */
    private function buildByRemissionReport($from, $to, $sales): array
    {
        $remissions = $sales->map(fn (Sale $sale) => $this->mapRemissionDetail($sale))->values();

        $revenue = round($remissions->sum('sale_price_num'), 2);
        $collected = round($remissions->sum('amount_paid'), 2);
        $pending = round($remissions->sum('amount_due'), 2);
        $cost = round($remissions->sum('purchase_price_num'), 2);
        $profit = round($remissions->sum('net_profit'), 2);

        return [
            'type' => 'by_remission',
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'is_range' => ! $from->isSameDay($to),
            'remissions' => $remissions,
            'totals' => [
                'count' => $remissions->count(),
                'revenue' => $revenue,
                'collected' => $collected,
                'pending' => $pending,
                'cost' => $cost,
                'profit' => $profit,
                'margin_percent' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : null,
                'apartados' => $remissions->where('status', 'apartado')->count(),
                'entregados' => $remissions->where('status', 'entregado')->count(),
                'payment_lines' => $remissions->sum('payment_count'),
            ],
            'methodology' => 'Detalle de ventas agrupado por número de remisión. Fecha del documento = venta cerrada (sold_at) o apartado (reserved_at). Cada remisión incluye el equipo y todos sus pagos. Utilidad bruta = precio de venta − costo congelado al momento de la operación.',
        ];
    }

    /** @return array{0: string, 1: array<string, mixed>} */
    private function resolveByRemissionReportForExport(Request $request): array
    {
        [$from, $to, $sales] = $this->resolveByRemissionSales($request);

        $label = $from->isSameDay($to)
            ? $to->format('Y-m-d')
            : $from->format('Y-m-d').'_'.$to->format('Y-m-d');

        return [$label, $this->buildByRemissionReport($from, $to, $sales)];
    }

    /** @return array{0: Carbon, 1: Carbon, 2: Collection<int, Sale>} */
    private function resolveByRemissionSales(Request $request): array
    {
        $user = $this->authorizeReports($request);
        [$periodStart, $periodEnd, $from, $to] = ReportPeriod::resolve($request);

        $sales = $this->reportSalesQuery($user, $request)
            ->whereNotNull('remission_number')
            ->whereRaw('COALESCE(sold_at, reserved_at) BETWEEN ? AND ?', [$periodStart, $periodEnd])
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer', 'creditPaymentMethod'])
            ->orderBy('remission_number')
            ->get();

        return [$from, $to, $sales];
    }

    /** @return array{0: User, 1: Carbon, 2: Carbon, 3: Collection, 4: array<string, mixed>} */
    private function resolveDailyReport(Request $request): array
    {
        $user = $this->authorizeReports($request);
        [$periodStart, $periodEnd, $from, $to] = ReportPeriod::resolve($request);

        $sales = $this->reportSalesQuery($user, $request)
            ->whereBetween('sold_at', [$periodStart, $periodEnd])
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer', 'creditPaymentMethod'])
            ->orderBy('sold_at')
            ->get();

        $period = $from->isSameDay($to)
            ? $to->toDateString()
            : $from->toDateString().'/'.$to->toDateString();

        $report = $this->buildSalesReport($sales, $period, 'daily', $from, $to);
        $report['period_from'] = $from->toDateString();
        $report['period_to'] = $to->toDateString();
        $report['is_range'] = ! $from->isSameDay($to);

        return [$user, $from, $to, $sales, $report];
    }

    /** @return array{0: string, 1: array<string, mixed>} */
    private function resolveDailyReportForExport(Request $request): array
    {
        [, $from, $to, , $report] = $this->resolveDailyReport($request);

        $label = $from->isSameDay($to)
            ? $to->format('Y-m-d')
            : $from->format('Y-m-d').'_'.$to->format('Y-m-d');

        return [$label, $report];
    }

    /** @return array{0: User, 1: Carbon, 2: Carbon, 3: array<string, mixed>} */
    private function resolveBySellerReport(Request $request): array
    {
        $user = $this->authorizeReports($request);
        [$periodStart, $periodEnd, $from, $to] = ReportPeriod::resolveMonthToDate($request);

        $sales = $this->reportSalesQuery($user, $request)
            ->whereBetween('sold_at', [$periodStart, $periodEnd])
            ->with(['inventoryItem', 'user', 'payments', 'creditPaymentMethod'])
            ->orderBy('sold_at')
            ->get();

        $rows = $sales->map(fn ($s) => $this->mapSaleRow($s));
        $grouped = $rows->groupBy(fn ($row) => $row['seller_id'] ?? 'unknown')->map(function ($items, $sellerId) {
            $first = $items->first();
            $revenue = round($items->sum('sale_price_num'), 2);
            $profit = round($items->sum('net_profit'), 2);

            return [
                'seller_id' => $sellerId === 'unknown' ? null : $sellerId,
                'seller' => $first['seller'] ?? 'Sin vendedor',
                'count' => $items->count(),
                'collected' => round($items->sum('amount_paid'), 2),
                'pending' => round($items->sum('amount_due'), 2),
                'revenue' => $revenue,
                'cost' => round($items->sum('purchase_price_num'), 2),
                'profit' => $profit,
                'margin_percent' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : null,
                'sales' => $items->values(),
            ];
        })->values()->sortByDesc('revenue')->values();

        $revenue = round($rows->sum('sale_price_num'), 2);
        $profit = round($rows->sum('net_profit'), 2);

        $report = [
            'type' => 'by_seller',
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'sellers' => $grouped,
            'totals' => [
                'count' => $rows->count(),
                'collected' => round($rows->sum('amount_paid'), 2),
                'pending' => round($rows->sum('amount_due'), 2),
                'revenue' => $revenue,
                'cost' => round($rows->sum('purchase_price_num'), 2),
                'profit' => $profit,
                'margin_percent' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : null,
            ],
            'methodology' => 'Ventas agrupadas por vendedor según fecha de venta. Utilidad bruta con costo congelado al momento de la venta.',
        ];

        return [$user, $from, $to, $report];
    }

    /** @return array{0: string, 1: array<string, mixed>} */
    private function resolveBySellerReportForExport(Request $request): array
    {
        [, $from, $to, $report] = $this->resolveBySellerReport($request);

        $label = $from->isSameDay($to)
            ? $to->format('Y-m-d')
            : $from->format('Y-m-d').'_'.$to->format('Y-m-d');

        return [$label, $report];
    }

    private function buildSalesReport($sales, string $period, string $type, $from = null, $to = null): array
    {
        $byMethod = [];
        $collectedInPeriod = 0.0;
        $rows = $sales->map(function ($s) use (&$byMethod, $from, $to, &$collectedInPeriod) {
            $row = $this->mapSaleRow($s);
            $methodAmounts = ($from && $to)
                ? SaleCostResolver::collectedByPaymentMethodInPeriod($s, $from, $to)
                : SaleCostResolver::collectedByPaymentMethod($s);

            foreach ($methodAmounts as $method => $amount) {
                $byMethod[$method] = round(($byMethod[$method] ?? 0) + $amount, 2);
                $collectedInPeriod += $amount;
            }

            return $row;
        });

        $revenue = round($rows->sum('sale_price_num'), 2);
        $cost = round($rows->sum('purchase_price_num'), 2);
        $profit = round($rows->sum('net_profit'), 2);

        return [
            'type' => $type,
            'period' => $period,
            'sales' => $rows,
            'totals' => [
                'count' => $sales->count(),
                'collected' => round($rows->sum('amount_paid'), 2),
                'collected_in_period' => round($collectedInPeriod, 2),
                'pending' => round($rows->sum('amount_due'), 2),
                'revenue' => $revenue,
                'cost' => $cost,
                'profit' => $profit,
                'margin_percent' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : null,
                'by_method' => $byMethod,
            ],
            'methodology' => 'Ingresos y utilidad por fecha de venta (devengo), excluyendo ventas devueltas por retoma. Recaudado/Pendiente = estado de cobro de esas ventas. Desglose por método = cobros con fecha de pago en el período.',
        ];
    }

    /** @param  array<int, string>  $periodSaleIds */
    private function mapLedgerPayment(SalePayment $payment, array $periodSaleIds): array
    {
        $sale = $payment->sale;
        $classification = $this->classifyCollectionType($sale, $payment);

        return [
            'id' => $payment->id,
            'paid_at' => $payment->paid_at,
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'type' => $classification['type'],
            'type_label' => $classification['label'],
            'sale_id' => $payment->sale_id,
            'remission_number' => $sale?->remission_number,
            'item' => $sale?->inventoryItem?->name,
            'customer' => $sale?->serviceCustomer?->name ?? $sale?->customer_name,
            'seller' => $sale?->user?->name,
            'notes' => $payment->notes,
            'sale_sold_at' => $sale?->sold_at,
            'on_period_sale' => in_array($payment->sale_id, $periodSaleIds, true),
        ];
    }

    /** @return array{type: string, label: string} */
    private function classifyCollectionType(?Sale $sale, SalePayment $payment): array
    {
        if (! $sale) {
            return ['type' => 'otro', 'label' => 'Cobro'];
        }

        if ($sale->reservation_status === SaleReservationStatus::ACTIVE) {
            return ['type' => 'apartado', 'label' => 'Abono apartado'];
        }

        if ($sale->sold_at && $payment->paid_at) {
            $soldDay = $sale->sold_at->toDateString();
            $paidDay = $payment->paid_at->toDateString();
            if ($paidDay > $soldDay) {
                return ['type' => 'abono', 'label' => 'Abono crédito'];
            }
        }

        if ((float) $sale->amount_due > 0 && $payment->notes && str_contains(strtolower($payment->notes), 'abono')) {
            return ['type' => 'abono', 'label' => 'Abono'];
        }

        return ['type' => 'venta', 'label' => 'Cobro venta'];
    }

    private function mapRetakeOutflow(Sale $sale): array
    {
        $amount = -1 * MoneyFormatter::parse($sale->retake_price ?? '0');

        return [
            'id' => 'retake-'.$sale->id,
            'paid_at' => $sale->returned_at,
            'amount' => round($amount, 2),
            'method' => $sale->retake_payment_method ?? 'efectivo',
            'type' => 'retoma',
            'type_label' => 'Pago retoma',
            'sale_id' => $sale->id,
            'remission_number' => $sale->remission_number,
            'item' => $sale->inventoryItem?->name,
            'customer' => $sale->customer_name,
            'seller' => $sale->user?->name,
            'notes' => 'Devolución de equipo',
            'sale_sold_at' => $sale->sold_at,
            'on_period_sale' => false,
        ];
    }

    private function mapReceivableRow(Sale $sale): array
    {
        $isApartado = $sale->reservation_status === SaleReservationStatus::ACTIVE;
        $dueAt = $sale->credit_due_at;
        $isOverdue = ! $isApartado && $dueAt && $dueAt->isPast();

        return [
            'id' => $sale->id,
            'remission_number' => $sale->remission_number,
            'type' => $isApartado ? 'apartado' : 'credito',
            'type_label' => $isApartado ? 'Apartado' : 'Crédito',
            'item' => $sale->inventoryItem?->name,
            'imei' => $sale->inventoryItem?->imei,
            'customer' => $sale->serviceCustomer?->name ?? $sale->customer_name,
            'customer_phone' => $sale->customer_phone,
            'seller' => $sale->user?->name,
            'sale_price' => MoneyFormatter::parse($sale->sale_price),
            'purchase_price_num' => SaleCostResolver::purchasePriceAtSale($sale),
            'net_profit' => SaleCostResolver::netProfit($sale),
            'amount_paid' => (float) $sale->amount_paid,
            'amount_due' => (float) $sale->amount_due,
            'payment_method' => $sale->payment_method,
            'credit_payment_method' => $sale->creditPaymentMethod?->name,
            'credit_term_type' => $sale->credit_term_type,
            'due_at' => $isApartado ? $sale->reserved_at : $dueAt,
            'sold_at' => $sale->sold_at,
            'reserved_at' => $sale->reserved_at,
            'is_overdue' => $isOverdue,
            'days_overdue' => $isOverdue ? (int) $dueAt->diffInDays(now()) : 0,
            'notes' => $sale->notes,
        ];
    }

    private function mapRemissionDetail(Sale $sale): array
    {
        $row = $this->mapSaleRow($sale);
        $isApartado = $sale->reservation_status === SaleReservationStatus::ACTIVE;
        $isReturned = $sale->isReturned();
        $paymentLabels = \App\Support\PaymentMethods::labels();

        $payments = $sale->relationLoaded('payments')
            ? $sale->payments->sortBy('paid_at')->values()
            : $sale->payments()->orderBy('paid_at')->get();

        return array_merge($row, [
            'remission_number' => $sale->remission_number,
            'sale_id' => $sale->id,
            'status' => $isReturned ? 'devuelto' : ($isApartado ? 'apartado' : ($sale->sold_at ? 'entregado' : 'registrado')),
            'status_label' => $isReturned ? 'Devuelto' : ($isApartado ? 'Apartado' : ($sale->sold_at ? 'Entregado' : 'Registrado')),
            'document_date' => $sale->sold_at ?? $sale->reserved_at,
            'customer_phone' => $sale->customer_phone ?? $sale->serviceCustomer?->phone,
            'credit_payment_method' => $sale->creditPaymentMethod?->name,
            'payment_count' => $payments->count(),
            'payments' => $payments->map(fn (SalePayment $payment) => [
                'id' => $payment->id,
                'paid_at' => $payment->paid_at,
                'method' => $payment->method,
                'method_label' => $paymentLabels[$payment->method] ?? $payment->method,
                'amount' => (float) $payment->amount,
                'notes' => $payment->notes,
            ])->values()->all(),
        ]);
    }

    private function mapSaleRow(Sale $s): array
    {
        $salePrice = MoneyFormatter::parse($s->sale_price);
        $purchasePrice = SaleCostResolver::purchasePriceAtSale($s);
        $purchasePriceRaw = $s->purchase_price_at_sale ?? $s->inventoryItem?->purchase_price;

        return [
            'id' => $s->id,
            'remission_number' => $s->remission_number,
            'sold_at' => $s->sold_at,
            'item' => $s->inventoryItem?->name,
            'imei' => $s->inventoryItem?->imei,
            'barcode' => $s->inventoryItem?->barcode,
            'sale_price' => $s->sale_price,
            'sale_price_num' => $salePrice,
            'purchase_price' => $purchasePriceRaw,
            'purchase_price_num' => $purchasePrice,
            'net_profit' => SaleCostResolver::netProfit($s),
            'margin_percent' => $salePrice > 0
                ? round((($salePrice - $purchasePrice) / $salePrice) * 100, 1)
                : null,
            'payment_method' => $s->payment_method,
            'credit_payment_method' => $s->creditPaymentMethod?->name,
            'credit_term_type' => $s->credit_term_type,
            'credit_due_at' => $s->credit_due_at,
            'amount_paid' => (float) $s->amount_paid,
            'amount_due' => (float) $s->amount_due,
            'customer' => $s->serviceCustomer?->name ?? $s->customer_name,
            'seller_id' => $s->user_id,
            'seller' => $s->user?->name,
        ];
    }

    /** @return array<string, mixed> */
    private function resolveInventoryIntakeReport(Request $request): array
    {
        $user = $this->authorizeReports($request);
        [$from, $to, $items] = $this->resolveInventoryIntakeItems($request, $user);
        $mapped = $items->map(fn (InventoryItem $item) => $this->mapInventoryIntakeRow($item))->values()->all();

        $bySupplier = collect($mapped)
            ->groupBy(fn (array $row) => $row['supplier_key'])
            ->map(function (Collection $rows, string $supplierKey) {
                $first = $rows->first();

                return [
                    'supplier_id' => $first['supplier_id'],
                    'supplier_name' => $first['supplier'],
                    'supplier_key' => $supplierKey,
                    'count' => $rows->count(),
                    'purchase_total' => round((float) $rows->sum('purchase_price'), 2),
                    'sale_value_total' => round((float) $rows->sum('sale_price'), 2),
                    'items' => $rows->values()->all(),
                ];
            })
            ->sortBy('supplier_name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();

        $purchaseTotal = round((float) collect($mapped)->sum('purchase_price'), 2);
        $saleValueTotal = round((float) collect($mapped)->sum('sale_price'), 2);

        return [
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'is_range' => ! $from->isSameDay($to),
            'methodology' => 'Equipos cuya fecha de ingreso (acquired_at o alta en sistema) cae dentro del período. El agrupamiento por proveedor usa el proveedor registrado en inventario.',
            'totals' => [
                'count' => count($mapped),
                'purchase_total' => $purchaseTotal,
                'sale_value_total' => $saleValueTotal,
                'supplier_count' => count($bySupplier),
            ],
            'by_supplier' => $bySupplier,
            'items' => $mapped,
        ];
    }

    /** @return array{0: string, 1: array<string, mixed>} */
    private function resolveInventoryIntakeReportForExport(Request $request): array
    {
        [, , $from, $to] = ReportPeriod::resolve($request);
        $report = $this->resolveInventoryIntakeReport($request);
        $label = $from->isSameDay($to)
            ? $to->format('Y-m-d')
            : $from->format('Y-m-d').'_'.$to->format('Y-m-d');

        return [$label, $report];
    }

    /** @return array{0: Carbon, 1: Carbon, 2: Collection<int, InventoryItem>} */
    private function resolveInventoryIntakeItems(Request $request, User $user): array
    {
        [$periodStart, $periodEnd, $from, $to] = ReportPeriod::resolve($request);

        $query = InventoryItem::query()->with('supplierRelation');
        $query = $this->scopeInventoryForUser($query, $user);
        $query->whereRaw('COALESCE(acquired_at, created_at) BETWEEN ? AND ?', [$periodStart, $periodEnd]);

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->string('supplier_id'));
        }

        $this->applyInventoryAttributeFilters($query, $request);

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('imei', 'like', $term)
                    ->orWhere('barcode', 'like', $term)
                    ->orWhere('supplier', 'like', $term);
            });
        }

        $items = $query
            ->orderByRaw('COALESCE(acquired_at, created_at)')
            ->orderBy('name')
            ->get();

        return [$from, $to, $items];
    }

    /** @return array<string, mixed> */
    private function mapInventoryIntakeRow(InventoryItem $item): array
    {
        $supplierName = trim((string) ($item->supplier ?: $item->supplierRelation?->name ?: ''));
        if ($supplierName === '') {
            $supplierName = 'Sin proveedor';
        }

        $acquiredAt = $item->acquired_at ?? $item->created_at;

        return [
            'id' => $item->id,
            'name' => $item->name,
            'imei' => $item->imei,
            'barcode' => $item->barcode,
            'color' => $item->color,
            'supplier_id' => $item->supplier_id,
            'supplier' => $supplierName,
            'supplier_key' => $item->supplier_id ?: mb_strtolower($supplierName),
            'purchase_price' => MoneyFormatter::parse($item->purchase_price),
            'sale_price' => MoneyFormatter::parse($item->sale_price),
            'battery' => $item->battery,
            'status' => $item->status,
            'status_label' => $this->inventoryStatusLabel($item->status),
            'acquired_at' => $acquiredAt,
            'notes' => $item->notes,
        ];
    }

    private function inventoryStatusLabel(?string $status): string
    {
        return match ($status) {
            InventoryStatus::DISPONIBLE => 'Disponible',
            InventoryStatus::VENDIDO => 'Vendido',
            InventoryStatus::RETOMADO => 'Retomado',
            InventoryStatus::SEPARADO => 'Separado',
            InventoryStatus::SERVICIO_TECNICO => 'Servicio técnico',
            default => $status ?? '—',
        };
    }

    /** @return array<string, mixed> */
    private function resolveServiceTicketsReport(Request $request): array
    {
        $user = $this->authorizeReports($request);
        [$from, $to, $tickets] = $this->resolveServiceTicketRows($request, $user);
        $mapped = $tickets->map(fn (ServiceTicket $ticket) => $this->mapServiceTicketReportRow($ticket))->values()->all();

        $byStatus = collect($mapped)
            ->groupBy('status')
            ->map(function (Collection $rows, string $status) {
                $first = $rows->first();

                return [
                    'status' => $status,
                    'status_label' => $first['status_label'] ?? $status,
                    'count' => $rows->count(),
                    'repair_cost' => round((float) $rows->sum('repair_cost'), 2),
                    'customer_price' => round((float) $rows->sum('customer_price'), 2),
                ];
            })
            ->sortBy('status_label', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();

        $byTechnician = collect($mapped)
            ->groupBy('technician_key')
            ->map(function (Collection $rows) {
                $first = $rows->first();

                return [
                    'technician' => $first['technician'] ?? 'Sin asignar',
                    'technician_key' => $first['technician_key'],
                    'count' => $rows->count(),
                    'repair_cost' => round((float) $rows->sum('repair_cost'), 2),
                    'customer_price' => round((float) $rows->sum('customer_price'), 2),
                ];
            })
            ->sortBy('technician', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();

        $repairCost = round((float) collect($mapped)->sum('repair_cost'), 2);
        $customerPrice = round((float) collect($mapped)->sum('customer_price'), 2);
        $margin = round($customerPrice - $repairCost, 2);

        return [
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'is_range' => ! $from->isSameDay($to),
            'methodology' => 'Tickets cuya fecha de recepción (received_at) cae dentro del período. El margen es precio al cliente menos costo de reparación por ticket.',
            'totals' => [
                'count' => count($mapped),
                'open_count' => collect($mapped)->where('is_open', true)->count(),
                'closed_count' => collect($mapped)->where('is_open', false)->count(),
                'repair_cost' => $repairCost,
                'customer_price' => $customerPrice,
                'margin' => $margin,
                'margin_percent' => $customerPrice > 0 ? round(($margin / $customerPrice) * 100, 1) : null,
            ],
            'by_status' => $byStatus,
            'by_technician' => $byTechnician,
            'tickets' => $mapped,
        ];
    }

    /** @return array{0: string, 1: array<string, mixed>} */
    private function resolveServiceTicketsReportForExport(Request $request): array
    {
        [, , $from, $to] = ReportPeriod::resolve($request);
        $report = $this->resolveServiceTicketsReport($request);
        $label = $from->isSameDay($to)
            ? $to->format('Y-m-d')
            : $from->format('Y-m-d').'_'.$to->format('Y-m-d');

        return [$label, $report];
    }

    /** @return array{0: Carbon, 1: Carbon, 2: Collection<int, ServiceTicket>} */
    private function resolveServiceTicketRows(Request $request, User $user): array
    {
        [$periodStart, $periodEnd, $from, $to] = ReportPeriod::resolve($request);

        $query = ServiceTicket::query()
            ->with(['inventoryItem', 'serviceCustomer', 'serviceTechnician', 'assignedUser', 'serviceCategory'])
            ->whereBetween('received_at', [$periodStart, $periodEnd]);

        ServiceTicketAccess::scopeForUser($query, $user);

        if ($request->filled('service_status')) {
            $query->where('status', $request->string('service_status'));
        } elseif ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('workshop')) {
            $query->where('workshop', $request->string('workshop'));
        }

        if ($this->requestHasInventoryAttributeFilters($request)) {
            $query->whereHas('inventoryItem', function ($itemQuery) use ($request) {
                $this->applyInventoryAttributeFilters($itemQuery, $request);
            });
        }

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('device_name', 'like', $term)
                    ->orWhere('device_reference', 'like', $term)
                    ->orWhere('issue_description', 'like', $term)
                    ->orWhere('customer_name', 'like', $term)
                    ->orWhereHas('inventoryItem', function ($itemQuery) use ($term) {
                        $itemQuery->where('name', 'like', $term)
                            ->orWhere('imei', 'like', $term)
                            ->orWhere('barcode', 'like', $term);
                    })
                    ->orWhereHas('serviceCustomer', fn ($c) => $c->where('name', 'like', $term));
            });
        }

        $tickets = $query->orderBy('received_at')->orderBy('created_at')->get();

        return [$from, $to, $tickets];
    }

    /** @return array<string, mixed> */
    private function mapServiceTicketReportRow(ServiceTicket $ticket): array
    {
        $statusLabels = ServiceTicketStateCatalog::labelsMap(false);
        $repairCost = (float) ($ticket->repair_cost ?? 0);
        $customerPrice = (float) ($ticket->customer_price ?? 0);
        $technician = $ticket->serviceTechnician?->name
            ?? $ticket->assignedUser?->name
            ?? 'Sin asignar';
        $technicianKey = $ticket->service_technician_id
            ?: ($ticket->assigned_user_id ? 'user:'.$ticket->assigned_user_id : 'none');

        return [
            'id' => $ticket->id,
            'ticket_type' => $ticket->ticket_type,
            'ticket_type_label' => $this->serviceTicketTypeLabel($ticket->ticket_type),
            'display_name' => $ticket->displayName(),
            'device_reference' => $ticket->device_reference,
            'imei' => $ticket->inventoryItem?->imei,
            'barcode' => $ticket->inventoryItem?->barcode,
            'customer_name' => $ticket->customer_name ?? $ticket->serviceCustomer?->name,
            'customer_phone' => $ticket->customer_phone ?? $ticket->serviceCustomer?->phone,
            'status' => $ticket->status,
            'status_label' => $statusLabels[$ticket->status] ?? $ticket->status,
            'technician' => $technician,
            'technician_key' => $technicianKey,
            'workshop' => $ticket->workshop,
            'category' => $ticket->serviceCategory?->name ?? $ticket->service_category,
            'repair_cost' => $repairCost,
            'customer_price' => $customerPrice,
            'margin' => round($customerPrice - $repairCost, 2),
            'is_warranty' => (bool) $ticket->is_warranty,
            'is_open' => $ticket->delivered_at === null,
            'issue_description' => $ticket->issue_description,
            'repair_notes' => $ticket->repair_notes,
            'received_at' => $ticket->received_at,
            'delivered_at' => $ticket->delivered_at,
        ];
    }

    private function serviceTicketTypeLabel(?string $type): string
    {
        return match ($type) {
            ServiceTicketType::INVENTARIO => 'Equipo de inventario',
            ServiceTicketType::CLIENTE_EXTERNO => 'Equipo de cliente',
            ServiceTicketType::GARANTIA => 'Garantía',
            default => $type ?? '—',
        };
    }
}

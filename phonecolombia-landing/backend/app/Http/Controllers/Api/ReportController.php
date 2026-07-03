<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\ServiceTicket;
use App\Models\User;
use App\Services\BySellerReportExporter;
use App\Services\CashRegisterReportExporter;
use App\Services\DailySalesReportExporter;
use App\Services\InventoryIntakeReportExporter;
use App\Services\ReceivablesReportExporter;
use App\Services\RemissionSalesReportExporter;
use App\Services\ServiceTicketsReportExporter;
use App\Support\InventoryStatus;
use App\Support\MoneyFormatter;
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
        $year = (int) ($request->input('year') ?? now()->year);
        $month = (int) ($request->input('month') ?? now()->month);
        $start = now()->setDate($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth();

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
        $from = $request->date('from') ?? now()->startOfDay();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        $salesQuery = $this->reportSalesQuery($user, $request);
        $allSalesQuery = $this->applySalesFilters($this->scopedSales($user), $request);
        $sales = (clone $salesQuery)
            ->whereBetween('sold_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->get();

        $periodSaleIds = $sales->pluck('id')->all();
        $scopedSaleIds = (clone $allSalesQuery)->pluck('id');
        $periodStart = $from->copy()->startOfDay();
        $periodEnd = $to->copy()->endOfDay();

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
        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now();

        $sales = $this->reportSalesQuery($user, $request)
            ->whereBetween('sold_at', [$from, $to])
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
        $to = $request->date('to') ?? $request->date('date') ?? now();
        $from = $request->date('from') ?? $to->copy();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        $periodStart = $from->copy()->startOfDay();
        $periodEnd = $to->copy()->endOfDay();

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
        $to = $request->date('to') ?? $request->date('date') ?? now();
        $from = $request->date('from') ?? $to->copy();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        $sales = $this->reportSalesQuery($user, $request)
            ->whereBetween('sold_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
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
        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        $sales = $this->reportSalesQuery($user, $request)
            ->whereBetween('sold_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
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
        [$from, $to] = $this->resolveInventoryIntakePeriod($request);
        $report = $this->resolveInventoryIntakeReport($request);
        $label = $from->isSameDay($to)
            ? $to->format('Y-m-d')
            : $from->format('Y-m-d').'_'.$to->format('Y-m-d');

        return [$label, $report];
    }

    /** @return array{0: Carbon, 1: Carbon, 2: Collection<int, InventoryItem>} */
    private function resolveInventoryIntakeItems(Request $request, User $user): array
    {
        [$from, $to] = $this->resolveInventoryIntakePeriod($request);
        $periodStart = $from->copy()->startOfDay();
        $periodEnd = $to->copy()->endOfDay();

        $query = InventoryItem::query()->with('supplierRelation');
        $query = $this->scopeInventoryForUser($query, $user);
        $query->whereRaw('COALESCE(acquired_at, created_at) BETWEEN ? AND ?', [$periodStart, $periodEnd]);

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->string('supplier_id'));
        }

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

    /** @return array{0: Carbon, 1: Carbon} */
    private function resolveInventoryIntakePeriod(Request $request): array
    {
        $to = $request->date('to') ?? $request->date('date') ?? now();
        $from = $request->date('from') ?? $to->copy();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        return [$from, $to];
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
        [$from, $to] = $this->resolveInventoryIntakePeriod($request);
        $report = $this->resolveServiceTicketsReport($request);
        $label = $from->isSameDay($to)
            ? $to->format('Y-m-d')
            : $from->format('Y-m-d').'_'.$to->format('Y-m-d');

        return [$label, $report];
    }

    /** @return array{0: Carbon, 1: Carbon, 2: Collection<int, ServiceTicket>} */
    private function resolveServiceTicketRows(Request $request, User $user): array
    {
        [$from, $to] = $this->resolveInventoryIntakePeriod($request);
        $periodStart = $from->copy()->startOfDay();
        $periodEnd = $to->copy()->endOfDay();

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

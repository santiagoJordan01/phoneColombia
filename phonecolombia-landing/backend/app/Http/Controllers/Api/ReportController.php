<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Services\BySellerReportExporter;
use App\Services\DailySalesReportExporter;
use App\Support\InventoryStatus;
use App\Support\MoneyFormatter;
use App\Support\SaleCostResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use ScopesInventoryForUser;

    public function __construct(
        private DailySalesReportExporter $dailyExporter,
        private BySellerReportExporter $bySellerExporter,
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

    public function monthly(Request $request): JsonResponse
    {
        $user = $this->authorizeReports($request);
        $year = (int) ($request->input('year') ?? now()->year);
        $month = (int) ($request->input('month') ?? now()->month);
        $start = now()->setDate($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth();

        $sales = $this->applySalesFilters($this->scopedSales($user), $request)
            ->whereBetween('sold_at', [$start, $end])
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer', 'creditPaymentMethod'])
            ->get();

        $inventoryQuery = InventoryItem::query();
        $inventoryQuery = $this->scopeInventoryForUser($inventoryQuery, $user);
        $available = (clone $inventoryQuery)->where('status', InventoryStatus::DISPONIBLE)->count();
        $soldInMonth = $sales->count();

        $report = $this->buildSalesReport($sales, $start->format('Y-m'), 'monthly');
        $report['inventory_available'] = $available;
        $report['units_sold'] = $soldInMonth;

        $prevStart = $start->copy()->subMonth();
        $prevEnd = $prevStart->copy()->endOfMonth();
        $prevMonthSales = $this->applySalesFilters($this->scopedSales($user), $request)
            ->whereBetween('sold_at', [$prevStart, $prevEnd])
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer', 'creditPaymentMethod'])
            ->get();
        $prevTotals = $this->buildSalesReport($prevMonthSales, $prevStart->format('Y-m'), 'monthly')['totals'];
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
        $user = $this->authorizeReports($request);
        $from = $request->date('from') ?? now()->startOfDay();
        $to = $request->date('to') ?? now()->endOfDay();

        $salesQuery = $this->applySalesFilters($this->scopedSales($user), $request);
        $sales = (clone $salesQuery)
            ->whereBetween('sold_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->get();

        $scopedSaleIds = (clone $salesQuery)->pluck('id');
        $paymentsInPeriod = SalePayment::query()
            ->whereIn('sale_id', $scopedSaleIds)
            ->whereBetween('paid_at', [$from, $to])
            ->get();

        $byMethod = $paymentsInPeriod
            ->groupBy('method')
            ->map(fn ($group) => round((float) $group->sum('amount'), 2))
            ->all();
        $cashCollected = round((float) $paymentsInPeriod->sum('amount'), 2);

        $expected = round($sales->sum(fn ($s) => MoneyFormatter::parse($s->sale_price)), 2);
        $salesCollected = round((float) $sales->sum('amount_paid'), 2);
        $pending = round((float) $sales->sum('amount_due'), 2);

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'sales_count' => $sales->count(),
            'by_payment_method' => $byMethod,
            'total_collected' => $cashCollected,
            'cash_collected_in_period' => $cashCollected,
            'total_expected' => $expected,
            'sales_collected_status' => $salesCollected,
            'pending_credits' => $pending,
            'difference' => round($expected - $salesCollected - $pending, 2),
        ]);
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

        $sales = $this->applySalesFilters($this->scopedSales($user), $request)
            ->whereBetween('sold_at', [$from, $to])
            ->with(['inventoryItem', 'user', 'creditPaymentMethod'])
            ->orderBy('sold_at')
            ->get();

        $filename = 'ventas_'.$from->format('Y-m-d').'_'.$to->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($sales) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Fecha', 'Equipo', 'IMEI', 'Precio venta', 'Costo', 'Utilidad', 'Método', 'Pagado', 'Pendiente', 'Cliente', 'Vendedor']);
            foreach ($sales as $sale) {
                $row = $this->mapSaleRow($sale);
                fputcsv($out, [
                    $sale->sold_at?->toDateTimeString(),
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
            $query->whereHas('inventoryItem', fn ($q) => $q->where('name', 'like', $term)->orWhere('imei', 'like', $term));
        }

        return $query;
    }

    /** @return array{0: \App\Models\User, 1: \Illuminate\Support\Carbon, 2: \Illuminate\Support\Carbon, 3: \Illuminate\Support\Collection, 4: array<string, mixed>} */
    private function resolveDailyReport(Request $request): array
    {
        $user = $this->authorizeReports($request);
        $to = $request->date('to') ?? $request->date('date') ?? now();
        $from = $request->date('from') ?? $to->copy();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        $sales = $this->applySalesFilters($this->scopedSales($user), $request)
            ->whereBetween('sold_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer', 'creditPaymentMethod'])
            ->orderBy('sold_at')
            ->get();

        $period = $from->isSameDay($to)
            ? $to->toDateString()
            : $from->toDateString().'/'.$to->toDateString();

        $report = $this->buildSalesReport($sales, $period, 'daily');
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

    /** @return array{0: \App\Models\User, 1: \Illuminate\Support\Carbon, 2: \Illuminate\Support\Carbon, 3: array<string, mixed>} */
    private function resolveBySellerReport(Request $request): array
    {
        $user = $this->authorizeReports($request);
        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        $sales = $this->applySalesFilters($this->scopedSales($user), $request)
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

    private function buildSalesReport($sales, string $period, string $type): array
    {
        $byMethod = [];
        $rows = $sales->map(function ($s) use (&$byMethod) {
            $row = $this->mapSaleRow($s);
            foreach (SaleCostResolver::collectedByPaymentMethod($s) as $method => $amount) {
                $byMethod[$method] = round(($byMethod[$method] ?? 0) + $amount, 2);
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
                'pending' => round($rows->sum('amount_due'), 2),
                'revenue' => $revenue,
                'cost' => $cost,
                'profit' => $profit,
                'margin_percent' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : null,
                'by_method' => $byMethod,
            ],
            'methodology' => 'Ingresos y utilidad por fecha de venta (devengo). Utilidad bruta = precio venta − costo al momento de la venta. Recaudado/Pendiente = estado de cobro de esas ventas.',
        ];
    }

    private function mapSaleRow(Sale $s): array
    {
        $salePrice = MoneyFormatter::parse($s->sale_price);
        $purchasePrice = SaleCostResolver::purchasePriceAtSale($s);
        $purchasePriceRaw = $s->purchase_price_at_sale ?? $s->inventoryItem?->purchase_price;

        return [
            'id' => $s->id,
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
}

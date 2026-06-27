<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Services\DailySalesReportExporter;
use App\Support\InventoryStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use ScopesInventoryForUser;

    public function __construct(
        private DailySalesReportExporter $dailyExporter,
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

    public function monthly(Request $request): JsonResponse
    {
        $user = $this->authorizeReports($request);
        $year = (int) ($request->input('year') ?? now()->year);
        $month = (int) ($request->input('month') ?? now()->month);
        $start = now()->setDate($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth();

        $sales = $this->applySalesFilters($this->scopedSales($user), $request)
            ->whereBetween('sold_at', [$start, $end])
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer'])
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
        $prevSales = $this->scopedSales($user)->whereBetween('sold_at', [$prevStart, $prevEnd])->sum('amount_paid');
        $report['comparison'] = [
            'previous_month_revenue' => $prevSales,
            'current_month_revenue' => $report['totals']['collected'],
            'change_percent' => $prevSales > 0
                ? round((($report['totals']['collected'] - $prevSales) / $prevSales) * 100, 1)
                : null,
        ];

        return response()->json($report);
    }

    public function cashRegister(Request $request): JsonResponse
    {
        $user = $this->authorizeReports($request);
        $from = $request->date('from') ?? now()->startOfDay();
        $to = $request->date('to') ?? now()->endOfDay();

        $sales = $this->applySalesFilters($this->scopedSales($user), $request)
            ->whereBetween('sold_at', [$from, $to])->get();
        $payments = SalePayment::query()
            ->whereIn('sale_id', $sales->pluck('id'))
            ->get();

        $byMethod = $payments->groupBy('method')->map->sum('amount');
        $collected = $payments->sum('amount');
        $expected = $sales->sum(fn ($s) => (float) preg_replace('/[^\d.]/', '', $s->sale_price));
        $pending = $sales->where('credit_status', 'pending')->sum('amount_due');

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'sales_count' => $sales->count(),
            'by_payment_method' => $byMethod,
            'total_collected' => $collected,
            'total_expected' => $expected,
            'pending_credits' => $pending,
            'difference' => $expected - $collected - $pending,
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
            ->with(['inventoryItem', 'user'])
            ->orderBy('sold_at')
            ->get();

        $filename = 'ventas_'.$from->format('Y-m-d').'_'.$to->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($sales) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Fecha', 'Equipo', 'IMEI', 'Precio', 'Método', 'Pagado', 'Pendiente', 'Cliente', 'Vendedor']);
            foreach ($sales as $sale) {
                fputcsv($out, [
                    $sale->sold_at?->toDateTimeString(),
                    $sale->inventoryItem?->name,
                    $sale->inventoryItem?->imei,
                    $sale->sale_price,
                    $sale->payment_method,
                    $sale->amount_paid,
                    $sale->amount_due,
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
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer'])
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

    private function buildSalesReport($sales, string $period, string $type): array
    {
        $byMethod = [];
        foreach ($sales as $sale) {
            $byMethod[$sale->payment_method] = ($byMethod[$sale->payment_method] ?? 0) + $sale->amount_paid;
        }

        return [
            'type' => $type,
            'period' => $period,
            'sales' => $sales->map(fn ($s) => [
                'id' => $s->id,
                'sold_at' => $s->sold_at,
                'item' => $s->inventoryItem?->name,
                'imei' => $s->inventoryItem?->imei,
                'sale_price' => $s->sale_price,
                'payment_method' => $s->payment_method,
                'amount_paid' => $s->amount_paid,
                'amount_due' => $s->amount_due,
                'customer' => $s->serviceCustomer?->name ?? $s->customer_name,
                'seller' => $s->user?->name,
            ]),
            'totals' => [
                'count' => $sales->count(),
                'collected' => $sales->sum('amount_paid'),
                'pending' => $sales->sum('amount_due'),
                'by_method' => $byMethod,
            ],
        ];
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Support\InventoryStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    use ScopesInventoryForUser;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canAccessInventory() && ! $user->canManageSales() && ! $user->canViewReports()) {
            return response()->json(['message' => 'Acceso no autorizado.'], 403);
        }

        $inventoryQuery = InventoryItem::query();
        $inventoryQuery = $this->scopeInventoryForUser($inventoryQuery, $user);

        $byStatus = (clone $inventoryQuery)
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();

        $salesQuery = Sale::query();
        if ($user->isSupplier() && $user->supplier_id) {
            $salesQuery->whereHas('inventoryItem', fn ($q) => $q->where('supplier_id', $user->supplier_id));
        }

        $scopedSaleIds = (clone $salesQuery)->pluck('id');
        $paymentsQuery = SalePayment::query()->whereIn('sale_id', $scopedSaleIds);

        $salesToday = (clone $salesQuery)->whereDate('sold_at', $today)->count();
        $salesMonth = (clone $salesQuery)->whereDate('sold_at', '>=', $monthStart)->count();
        $collectedToday = (clone $paymentsQuery)->whereDate('paid_at', $today)->sum('amount');
        $collectedMonth = (clone $paymentsQuery)->whereDate('paid_at', '>=', $monthStart)->sum('amount');
        $pendingCredits = (clone $salesQuery)->where('credit_status', 'pending')->count();
        $pendingCreditAmount = (clone $salesQuery)->where('credit_status', 'pending')->sum('amount_due');

        $salesLast7 = [];
        $collectedLast7 = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $salesLast7[] = (int) (clone $salesQuery)->whereDate('sold_at', $date)->count();
            $collectedLast7[] = (float) (clone $paymentsQuery)->whereDate('paid_at', $date)->sum('amount');
        }

        $inventoryAddedLast7 = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $inventoryAddedLast7[] = (int) (clone $inventoryQuery)->whereDate('created_at', $date)->count();
        }

        return response()->json([
            'inventory' => [
                'total' => $byStatus->sum(),
                'disponible' => (int) ($byStatus[InventoryStatus::DISPONIBLE] ?? 0),
                'servicio_tecnico' => (int) ($byStatus[InventoryStatus::SERVICIO_TECNICO] ?? 0),
                'separado' => (int) ($byStatus[InventoryStatus::SEPARADO] ?? 0),
                'vendido' => (int) ($byStatus[InventoryStatus::VENDIDO] ?? 0),
                'retomado' => (int) ($byStatus[InventoryStatus::RETOMADO] ?? 0),
            ],
            'sales' => [
                'today_count' => $salesToday,
                'month_count' => $salesMonth,
                'collected_today' => (float) $collectedToday,
                'collected_month' => (float) $collectedMonth,
                'revenue_today' => (float) $collectedToday,
                'revenue_month' => (float) $collectedMonth,
                'pending_credits' => $pendingCredits,
                'pending_credit_amount' => $pendingCreditAmount,
            ],
            'trends' => [
                'sales_count_7d' => $salesLast7,
                'collected_7d' => $collectedLast7,
                'sales_revenue_7d' => $collectedLast7,
                'inventory_added_7d' => $inventoryAddedLast7,
            ],
        ]);
    }
}

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
        if (! $user->canAccessInventory() && ! $user->canManageSales()) {
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

        $salesToday = (clone $salesQuery)->whereDate('sold_at', $today)->count();
        $salesMonth = (clone $salesQuery)->whereDate('sold_at', '>=', $monthStart)->count();
        $revenueToday = (clone $salesQuery)->whereDate('sold_at', $today)->sum('amount_paid');
        $revenueMonth = (clone $salesQuery)->whereDate('sold_at', '>=', $monthStart)->sum('amount_paid');
        $pendingCredits = (clone $salesQuery)->where('credit_status', 'pending')->count();
        $pendingCreditAmount = (clone $salesQuery)->where('credit_status', 'pending')->sum('amount_due');

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
                'revenue_today' => $revenueToday,
                'revenue_month' => $revenueMonth,
                'pending_credits' => $pendingCredits,
                'pending_credit_amount' => $pendingCreditAmount,
            ],
        ]);
    }
}

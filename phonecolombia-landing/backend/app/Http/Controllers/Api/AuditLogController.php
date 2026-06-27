<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\ServiceTicket;
use App\Models\User;
use App\Support\AuditLogPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSuperAdmin()) {
            return response()->json(['message' => 'Solo administradores pueden ver auditoría.'], 403);
        }

        $query = AuditLog::query()->with('user')->orderByDesc('created_at');

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }
        if ($request->filled('action')) {
            $query->where('action', $request->string('action'));
        }
        if ($request->filled('entity')) {
            $type = collect(AuditLogPresenter::ENTITY_KEYS)
                ->search($request->string('entity')->toString());
            if ($type !== false) {
                $query->where('auditable_type', $type);
            }
        }
        if ($request->filled('auditable_type')) {
            $query->where('auditable_type', 'like', '%'.$request->string('auditable_type').'%');
        }
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->date('to'));
        }
        if ($request->filled('q')) {
            $term = $request->string('q')->toString();
            $like = '%'.$term.'%';
            $itemIds = InventoryItem::withTrashed()
                ->where(function ($itemQuery) use ($like) {
                    $itemQuery->where('name', 'like', $like)
                        ->orWhere('imei', 'like', $like)
                        ->orWhere('barcode', 'like', $like);
                })
                ->pluck('id');
            $saleIds = Sale::query()
                ->whereIn('inventory_item_id', $itemIds)
                ->pluck('id');
            $userIds = User::query()
                ->where('name', 'like', $like)
                ->orWhere('email', 'like', $like)
                ->pluck('id');
            $ticketIds = ServiceTicket::query()
                ->whereIn('inventory_item_id', $itemIds)
                ->pluck('id');

            $query->where(function ($inner) use ($like, $itemIds, $saleIds, $userIds, $ticketIds) {
                $inner->where('old_value', 'like', $like)
                    ->orWhere('new_value', 'like', $like)
                    ->orWhere('auditable_id', 'like', $like)
                    ->orWhere('field', 'like', $like)
                    ->orWhere('action', 'like', $like)
                    ->orWhere(function ($inventoryLogs) use ($itemIds) {
                        $inventoryLogs->where('auditable_type', InventoryItem::class)
                            ->whereIn('auditable_id', $itemIds);
                    })
                    ->orWhere(function ($saleLogs) use ($saleIds) {
                        $saleLogs->where('auditable_type', Sale::class)
                            ->whereIn('auditable_id', $saleIds);
                    })
                    ->orWhere(function ($userLogs) use ($userIds) {
                        $userLogs->where('auditable_type', User::class)
                            ->whereIn('auditable_id', $userIds);
                    })
                    ->orWhere(function ($ticketLogs) use ($ticketIds) {
                        $ticketLogs->where('auditable_type', ServiceTicket::class)
                            ->whereIn('auditable_id', $ticketIds);
                    });
            });
        }

        $logs = $query->limit(500)->get();
        $presenter = new AuditLogPresenter;

        try {
            return response()->json([
                'data' => $presenter->presentCollection($logs),
                'summary' => $presenter->summarize($logs),
                'filters' => AuditLogPresenter::filterOptions(),
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'data' => $logs->map(fn (AuditLog $log) => [
                    'id' => $log->id,
                    'created_at' => $log->created_at,
                    'user_id' => $log->user_id,
                    'user' => $log->user,
                    'auditable_type' => $log->auditable_type,
                    'auditable_id' => $log->auditable_id,
                    'action' => $log->action,
                    'action_label' => $log->action,
                    'field' => $log->field,
                    'old_value' => $log->old_value,
                    'new_value' => $log->new_value,
                    'meta' => $log->meta,
                    'description' => $log->action,
                ])->all(),
                'summary' => ['total' => $logs->count(), 'by_action' => [], 'by_entity' => []],
                'filters' => AuditLogPresenter::filterOptions(),
            ]);
        }
    }
}

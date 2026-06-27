<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryProduct;
use App\Models\Sale;
use App\Models\Supplier;
use App\Services\AuditService;
use App\Services\InventoryMovementService;
use App\Support\InventoryFieldGuard;
use App\Support\InventoryStatus;
use App\Support\InventoryStatusGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryItemController extends Controller
{
    use DeniesReadOnlyInventoryRoles, ScopesInventoryForUser;

    public function __construct(
        private InventoryMovementService $movements,
        private AuditService $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $archived = $request->boolean('archived');

        $query = ($archived ? InventoryItem::onlyTrashed() : InventoryItem::query())
            ->with(['inventoryProduct', 'supplierRelation'])
            ->orderByDesc($archived ? 'deleted_at' : 'created_at');

        $query = $this->scopeInventoryForUser($query, $user);

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->boolean('sale_eligible')) {
            $query->whereIn('status', InventoryStatusGuard::SALE_ELIGIBLE_STATUSES);
        }

        if ($request->filled('exclude_status')) {
            $query->where('status', '!=', $request->string('exclude_status'));
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->string('supplier_id'));
        }

        if ($request->filled('barcode')) {
            $query->where('barcode', trim($request->string('barcode')->toString()));
        }

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('imei', 'like', $term)
                    ->orWhere('barcode', 'like', $term)
                    ->orWhere('supplier', 'like', $term)
                    ->orWhere('notes', 'like', $term)
                    ->orWhereHas('inventoryProduct', fn ($p) => $p->where('name', 'like', $term));
            });
        }

        $items = $query->get()->map(fn (InventoryItem $item) => $this->serializeItem($item, $user));

        return response()->json($items);
    }

    public function summaryByModel(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = InventoryItem::query()
            ->select([
                'name',
                'inventory_product_id',
                'status',
                DB::raw('COUNT(*) as count'),
            ])
            ->groupBy('name', 'inventory_product_id', 'status');

        $query = $this->scopeInventoryForUser($query, $user);

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        $rows = $query->get();
        $grouped = [];

        foreach ($rows as $row) {
            $key = $row->inventory_product_id ?: $row->name;
            if (! isset($grouped[$key])) {
                $grouped[$key] = [
                    'name' => $row->name,
                    'inventory_product_id' => $row->inventory_product_id,
                    'total' => 0,
                    'by_status' => array_fill_keys(InventoryStatus::ALL, 0),
                ];
            }
            $grouped[$key]['by_status'][$row->status] = (int) $row->count;
            $grouped[$key]['total'] += (int) $row->count;
        }

        $palette = ['#dbeafe', '#dcfce7', '#fef3c7', '#ede9fe', '#fce7f3', '#e0f2fe', '#f3f4f6'];
        $result = array_values($grouped);
        foreach ($result as $i => &$group) {
            $group['color'] = $palette[$i % count($palette)];
        }

        usort($result, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return response()->json($result);
    }

    public function show(Request $request, string $inventoryItem): JsonResponse
    {
        $inventoryItem = InventoryItem::withTrashed()->findOrFail($inventoryItem);

        $this->authorizeItemAccess($request, $inventoryItem);

        $inventoryItem->load(['inventoryProduct', 'supplierRelation', 'movements.user']);

        return response()->json($this->serializeItem($inventoryItem, $request->user(), includeMovements: true));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->denyIfReadOnlyInventoryRole($user, 'registrar equipos');

        $data = InventoryFieldGuard::stripRestrictedUpdates(
            $this->applyProductDefaults($this->validated($request)),
            $user,
        );
        $data['quantity'] = 1;
        $data['status'] = $data['status'] ?? InventoryStatus::DISPONIBLE;
        $data['acquired_at'] = $data['acquired_at'] ?? now();

        InventoryStatusGuard::assertAllowedOnCreate($data['status']);

        $this->syncSupplierFields($data);

        $item = InventoryItem::create($data);
        $this->movements->record($item, 'ingreso', null, null, $item->status, 'Ingreso al inventario');
        $this->audit->log($item, 'created');

        return response()->json($this->serializeItem($item->load(['inventoryProduct', 'supplierRelation']), $user), 201);
    }

    public function update(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $this->authorizeItemAccess($request, $inventoryItem);
        $user = $request->user();
        $this->denyIfReadOnlyInventoryRole($user);

        $data = InventoryFieldGuard::stripRestrictedUpdates(
            $this->applyProductDefaults($this->validated($request, partial: true)),
            $user,
        );

        if (isset($data['imei']) && $data['imei'] !== $inventoryItem->imei) {
            $exists = InventoryItem::query()
                ->where('imei', $data['imei'])
                ->where('id', '!=', $inventoryItem->id)
                ->whereNull('deleted_at')
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'Ya existe un equipo con ese IMEI.'], 422);
            }
        }

        if (isset($data['barcode']) && $data['barcode'] !== $inventoryItem->barcode) {
            $exists = InventoryItem::query()
                ->where('barcode', $data['barcode'])
                ->where('id', '!=', $inventoryItem->id)
                ->whereNull('deleted_at')
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'Ya existe un equipo con ese código de barras.'], 422);
            }
        }

        $this->syncSupplierFields($data);

        if (isset($data['status'])) {
            InventoryStatusGuard::assertManualTransition($inventoryItem, $data['status']);
        }

        $original = $inventoryItem->getOriginal();
        $inventoryItem->update($data);

        $changes = $inventoryItem->getChanges();
        unset($changes['updated_at']);
        $this->movements->recordItemChanges($inventoryItem, $original, $changes);
        $this->audit->logChanges($inventoryItem, $original, $changes);

        return response()->json($this->serializeItem($inventoryItem->fresh()->load(['inventoryProduct', 'supplierRelation']), $user));
    }

    public function destroy(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $this->authorizeItemAccess($request, $inventoryItem);
        $this->denyIfReadOnlyInventoryRole($request->user(), 'archivar equipos');

        if ($inventoryItem->status === InventoryStatus::VENDIDO) {
            return response()->json(['message' => 'No se puede eliminar un equipo vendido. Use retoma para reingresarlo.'], 422);
        }

        if (InventoryStatusGuard::hasOpenServiceTicket($inventoryItem)) {
            return response()->json(['message' => 'No se puede archivar un equipo con ticket de servicio técnico abierto.'], 422);
        }

        $this->movements->record($inventoryItem, 'archived', 'status', $inventoryItem->status, 'archived');
        $this->audit->log($inventoryItem, 'soft_deleted');
        $inventoryItem->delete();

        return response()->json(['message' => 'Equipo archivado del inventario']);
    }

    public function retake(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $this->authorizeItemAccess($request, $inventoryItem);
        $this->denyIfReadOnlyInventoryRole($request->user(), 'retomar equipos');

        if ($inventoryItem->status === InventoryStatus::VENDIDO) {
            $oldStatus = $inventoryItem->status;
            $sale = Sale::query()
                ->where('inventory_item_id', $inventoryItem->id)
                ->orderByDesc('sold_at')
                ->first();
            $meta = $sale ? ['sale_id' => $sale->id] : null;

            $inventoryItem->update(['status' => InventoryStatus::RETOMADO]);
            $this->movements->record($inventoryItem, 'retoma', 'status', $oldStatus, InventoryStatus::RETOMADO, 'Equipo retomado', $meta);
            $this->audit->log($inventoryItem, 'retake', 'status', $oldStatus, InventoryStatus::RETOMADO, $meta);

            return response()->json($this->serializeItem($inventoryItem->fresh()->load(['inventoryProduct', 'supplierRelation']), $request->user()));
        }

        if ($inventoryItem->status === InventoryStatus::RETOMADO) {
            $oldStatus = $inventoryItem->status;
            $inventoryItem->update(['status' => InventoryStatus::DISPONIBLE]);
            $this->movements->record($inventoryItem, 'reingreso', 'status', $oldStatus, InventoryStatus::DISPONIBLE, 'Reingreso al inventario');
            $this->audit->log($inventoryItem, 'reingreso', 'status', $oldStatus, InventoryStatus::DISPONIBLE);

            return response()->json($this->serializeItem($inventoryItem->fresh()->load(['inventoryProduct', 'supplierRelation']), $request->user()));
        }

        return response()->json(['message' => 'Solo equipos vendidos o retomados pueden procesarse en retoma.'], 422);
    }

    private function authorizeItemAccess(Request $request, InventoryItem $item): void
    {
        $user = $request->user();
        if ($user->isSupplier() && $user->supplier_id && $item->supplier_id !== $user->supplier_id) {
            abort(403, 'No tienes acceso a este equipo.');
        }
    }

    private function syncSupplierFields(array &$data): void
    {
        if (! empty($data['supplier_id'])) {
            $supplier = Supplier::find($data['supplier_id']);
            if ($supplier) {
                $data['supplier'] = $supplier->name;
            }
        } elseif (! empty($data['supplier']) && empty($data['supplier_id'])) {
            $supplier = Supplier::query()->where('name', $data['supplier'])->first();
            if ($supplier) {
                $data['supplier_id'] = $supplier->id;
            }
        }
    }

    private function applyProductDefaults(array $data): array
    {
        if (empty($data['inventory_product_id'])) {
            return $data;
        }

        $product = InventoryProduct::findOrFail($data['inventory_product_id']);
        if (empty($data['name'])) {
            $data['name'] = $product->name;
        }

        if (empty($data['color']) && $product->color) {
            $data['color'] = $product->color;
        }

        return $data;
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $rules = [
            'inventory_product_id' => ['nullable', 'uuid', 'exists:inventory_products,id'],
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'imei' => ['nullable', 'string', 'max:50'],
            'barcode' => ['nullable', 'string', 'max:64'],
            'color' => ['nullable', 'string', 'max:50'],
            'supplier' => ['nullable', 'string', 'max:100'],
            'supplier_id' => ['nullable', 'uuid', 'exists:suppliers,id'],
            'purchase_price' => ['nullable', 'string', 'max:50'],
            'sale_price' => ['nullable', 'string', 'max:50'],
            'battery' => ['nullable', 'integer', 'min:0', 'max:100'],
            'status' => ['nullable', 'string', Rule::in(InventoryStatus::ALL)],
            'notes' => ['nullable', 'string'],
            'acquired_at' => ['nullable', 'date'],
        ];

        if (! $partial) {
            $rules['imei'][] = Rule::unique('inventory_items', 'imei')->whereNull('deleted_at');
            $rules['barcode'][] = Rule::unique('inventory_items', 'barcode')->whereNull('deleted_at');
        }

        return $request->validate($rules);
    }

    private function serializeItem(InventoryItem $item, $user, bool $includeMovements = false): array
    {
        $data = [
            'id' => $item->id,
            'inventory_product_id' => $item->inventory_product_id,
            'name' => $item->name,
            'imei' => $item->imei,
            'barcode' => $item->barcode,
            'color' => $item->color,
            'supplier' => $item->supplier,
            'supplier_id' => $item->supplier_id,
            'supplier_relation' => $item->supplierRelation,
            'purchase_price' => $item->purchase_price,
            'sale_price' => $item->sale_price,
            'battery' => $item->battery,
            'status' => $item->status,
            'notes' => $item->notes,
            'acquired_at' => $item->acquired_at,
            'created_at' => $item->created_at,
            'updated_at' => $item->updated_at,
            'inventory_product' => $item->inventoryProduct,
        ];

        if ($item->trashed()) {
            $data['is_archived'] = true;
            $data['deleted_at'] = $item->deleted_at;
        }

        if ($includeMovements) {
            $data['movements'] = $item->movements->map(fn ($m) => [
                'id' => $m->id,
                'type' => $m->type,
                'field' => $m->field,
                'old_value' => $m->old_value,
                'new_value' => $m->new_value,
                'notes' => $m->notes,
                'meta' => $m->meta,
                'user' => $m->user ? ['id' => $m->user->id, 'name' => $m->user->name] : null,
                'created_at' => $m->created_at,
            ]);
        }

        return InventoryFieldGuard::filterItemArray($data, $user);
    }
}

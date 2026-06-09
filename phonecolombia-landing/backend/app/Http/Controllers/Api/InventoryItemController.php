<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = InventoryItem::query()
            ->with('inventoryProduct')
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('imei', 'like', $term)
                    ->orWhere('supplier', 'like', $term)
                    ->orWhere('notes', 'like', $term)
                    ->orWhereHas('inventoryProduct', fn ($p) => $p->where('name', 'like', $term));
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->applyProductDefaults($this->validated($request));
        $data['quantity'] = 1;

        $item = InventoryItem::create($data);

        return response()->json($item->load('inventoryProduct'), 201);
    }

    public function update(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $data = $this->applyProductDefaults($this->validated($request, partial: true));

        $inventoryItem->update($data);

        return response()->json($inventoryItem->fresh()->load('inventoryProduct'));
    }

    public function destroy(InventoryItem $inventoryItem): JsonResponse
    {
        $inventoryItem->delete();

        return response()->json(['message' => 'Equipo eliminado del inventario']);
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
            'color' => ['nullable', 'string', 'max:50'],
            'supplier' => ['nullable', 'string', 'max:100'],
            'sale_price' => ['nullable', 'string', 'max:50'],
            'battery' => ['nullable', 'integer', 'min:0', 'max:100'],
            'status' => ['nullable', 'string', Rule::in([
                'disponible',
                'servicio_tecnico',
                'separado',
                'vendido',
            ])],
            'notes' => ['nullable', 'string'],
        ];

        return $request->validate($rules);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Controller;
use App\Models\InventoryProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryProductController extends Controller
{
    use DeniesReadOnlyInventoryRoles;

    public function index(): JsonResponse
    {
        $products = InventoryProduct::query()
            ->orderBy('name')
            ->get();

        return response()->json($products);
    }

    public function store(Request $request): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', Rule::in(['celular', 'tablet', 'accesorio', 'computador', 'otro'])],
            'brand' => ['nullable', 'string', 'max:80'],
            'model' => ['nullable', 'string', 'max:120'],
            'storage' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:50'],
            'reference_price' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ]);

        $name = $this->composeName($data);

        if ($name === '') {
            return response()->json([
                'message' => 'Indica el modelo o un nombre completo para el equipo.',
            ], 422);
        }

        $product = InventoryProduct::create([
            'name' => $name,
            'category' => $data['category'] ?? 'celular',
            'brand' => isset($data['brand']) ? strtoupper(trim($data['brand'])) : null,
            'model' => isset($data['model']) ? strtoupper(trim($data['model'])) : null,
            'storage' => isset($data['storage']) ? strtoupper(trim($data['storage'])) : null,
            'color' => null,
            'reference_price' => $data['reference_price'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json($product, 201);
    }

    public function update(Request $request, InventoryProduct $inventoryProduct): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', Rule::in(['celular', 'tablet', 'accesorio', 'computador', 'otro'])],
            'brand' => ['nullable', 'string', 'max:80'],
            'model' => ['nullable', 'string', 'max:120'],
            'storage' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:50'],
            'reference_price' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ]);

        $name = $this->composeName($data);

        if ($name === '') {
            return response()->json([
                'message' => 'Indica el modelo o un nombre completo para el equipo.',
            ], 422);
        }

        $inventoryProduct->update([
            'name' => $name,
            'category' => $data['category'] ?? 'celular',
            'brand' => isset($data['brand']) ? strtoupper(trim($data['brand'])) : null,
            'model' => isset($data['model']) ? strtoupper(trim($data['model'])) : null,
            'storage' => isset($data['storage']) ? strtoupper(trim($data['storage'])) : null,
            'color' => null,
            'reference_price' => $data['reference_price'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json($inventoryProduct->fresh());
    }

    public function destroy(Request $request, InventoryProduct $inventoryProduct): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $inventoryProduct->delete();

        return response()->json(['message' => 'Modelo eliminado del catálogo']);
    }

    private function composeName(array $data): string
    {
        if (! empty($data['name'])) {
            return strtoupper(trim($data['name']));
        }

        $parts = array_filter([
            isset($data['brand']) ? trim($data['brand']) : null,
            isset($data['model']) ? trim($data['model']) : null,
            isset($data['storage']) ? trim($data['storage']) : null,
        ]);

        return strtoupper(implode(' ', $parts));
    }
}

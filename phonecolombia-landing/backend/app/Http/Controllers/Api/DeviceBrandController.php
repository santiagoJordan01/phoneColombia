<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Controller;
use App\Models\DeviceBrand;
use App\Models\InventoryProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DeviceBrandController extends Controller
{
    use DeniesReadOnlyInventoryRoles;

    public function index(): JsonResponse
    {
        $brands = DeviceBrand::query()
            ->orderBy('name')
            ->get();

        return response()->json($brands);
    }

    public function store(Request $request): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', 'unique:device_brands,name'],
        ]);

        $brand = DeviceBrand::create([
            'name' => strtoupper(trim($data['name'])),
        ]);

        return response()->json($brand, 201);
    }

    public function update(Request $request, DeviceBrand $deviceBrand): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('device_brands', 'name')->ignore($deviceBrand->id)],
        ]);

        $oldName = $deviceBrand->name;
        $newName = strtoupper(trim($data['name']));

        if ($oldName !== $newName) {
            $deviceBrand->update(['name' => $newName]);

            InventoryProduct::query()
                ->where('brand', $oldName)
                ->get()
                ->each(function (InventoryProduct $product) use ($newName) {
                    $product->brand = $newName;
                    $product->name = $this->composeProductName($product);
                    $product->save();
                });
        }

        return response()->json($deviceBrand->fresh());
    }

    public function destroy(Request $request, DeviceBrand $deviceBrand): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $deviceBrand->delete();

        return response()->json(['message' => 'Marca eliminada']);
    }

    private function composeProductName(InventoryProduct $product): string
    {
        $parts = array_filter([
            $product->brand,
            $product->model,
            $product->storage,
        ]);

        return strtoupper(implode(' ', $parts));
    }
}

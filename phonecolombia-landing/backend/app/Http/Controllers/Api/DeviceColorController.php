<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Controller;
use App\Models\DeviceColor;
use App\Models\InventoryItem;
use App\Models\InventoryProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DeviceColorController extends Controller
{
    use DeniesReadOnlyInventoryRoles;

    public function index(): JsonResponse
    {
        $colors = DeviceColor::query()
            ->orderBy('name')
            ->get();

        return response()->json($colors);
    }

    public function store(Request $request): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:device_colors,name'],
        ]);

        $color = DeviceColor::create([
            'name' => strtoupper(trim($data['name'])),
        ]);

        return response()->json($color, 201);
    }

    public function update(Request $request, DeviceColor $deviceColor): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:50', Rule::unique('device_colors', 'name')->ignore($deviceColor->id)],
        ]);

        $oldName = $deviceColor->name;
        $newName = strtoupper(trim($data['name']));

        if ($oldName !== $newName) {
            $deviceColor->update(['name' => $newName]);

            InventoryItem::query()
                ->where('color', $oldName)
                ->update(['color' => $newName]);

            InventoryProduct::query()
                ->where('color', $oldName)
                ->get()
                ->each(function (InventoryProduct $product) use ($newName) {
                    $product->color = $newName;
                    $product->name = $this->composeProductName($product);
                    $product->save();
                });
        }

        return response()->json($deviceColor->fresh());
    }

    public function destroy(Request $request, DeviceColor $deviceColor): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $deviceColor->delete();

        return response()->json(['message' => 'Color eliminado']);
    }

    private function composeProductName(InventoryProduct $product): string
    {
        $parts = array_filter([
            $product->brand,
            $product->model,
            $product->storage,
            $product->color,
        ]);

        return strtoupper(implode(' ', $parts));
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Support\FileUploader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(): JsonResponse
    {
        $products = Product::query()
            ->orderByDesc('created_at')
            ->get();

        return response()->json($products);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'price' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'images' => ['nullable'],
            'images.*' => ['file', 'image', 'max:10240'],
        ]);

        $images = FileUploader::uploadMany(
            FileUploader::collectFiles($request, 'images'),
            'products'
        );

        if (empty($images)) {
            return response()->json(['message' => 'Debes seleccionar al menos una imagen.'], 422);
        }

        $product = Product::create([
            'name' => $data['name'],
            'price' => $data['price'] ?? null,
            'description' => $data['description'] ?? null,
            'images' => $images,
        ]);

        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'price' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'images' => ['nullable'],
            'images.*' => ['file', 'image', 'max:10240'],
        ]);

        $updateData = [];

        if (array_key_exists('name', $data)) {
            $updateData['name'] = $data['name'];
        }
        if (array_key_exists('price', $data)) {
            $updateData['price'] = $data['price'];
        }
        if (array_key_exists('description', $data)) {
            $updateData['description'] = $data['description'];
        }

        $newImages = FileUploader::uploadMany(
            FileUploader::collectFiles($request, 'images'),
            'products'
        );

        if (! empty($newImages)) {
            foreach ($product->images ?? [] as $oldUrl) {
                FileUploader::deleteByUrl($oldUrl);
            }
            $updateData['images'] = $newImages;
        }

        $product->update($updateData);

        return response()->json($product->fresh());
    }

    public function destroy(Product $product): JsonResponse
    {
        foreach ($product->images ?? [] as $url) {
            FileUploader::deleteByUrl($url);
        }

        $product->delete();

        return response()->json(['message' => 'Producto eliminado']);
    }
}

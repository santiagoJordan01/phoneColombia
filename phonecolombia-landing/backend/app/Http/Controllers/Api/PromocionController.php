<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Promocion;
use App\Support\FileUploader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PromocionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Promocion::query();

        if ($request->boolean('asc')) {
            $query->orderBy('created_at');
        } else {
            $query->orderByDesc('created_at');
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'precio' => ['required', 'string', 'max:255'],
            'bundle' => ['required', 'string', 'max:255'],
            'alt' => ['nullable', 'string', 'max:255'],
            'imagen' => ['required', 'file', 'image', 'max:10240'],
        ]);

        $imagenUrl = FileUploader::upload($request->file('imagen'), 'promociones');

        $promocion = Promocion::create([
            'nombre' => $data['nombre'],
            'precio' => $data['precio'],
            'bundle' => $data['bundle'],
            'alt' => $data['alt'] ?? null,
            'imagen_url' => $imagenUrl,
        ]);

        return response()->json($promocion, 201);
    }

    public function destroy(Promocion $promocion): JsonResponse
    {
        FileUploader::deleteByUrl($promocion->imagen_url);
        $promocion->delete();

        return response()->json(['message' => 'Promoción eliminada']);
    }
}

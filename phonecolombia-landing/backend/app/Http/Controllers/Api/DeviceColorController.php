<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceColor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceColorController extends Controller
{
    public function index(): JsonResponse
    {
        $colors = DeviceColor::query()
            ->orderBy('name')
            ->get();

        return response()->json($colors);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:device_colors,name'],
        ]);

        $color = DeviceColor::create([
            'name' => strtoupper(trim($data['name'])),
        ]);

        return response()->json($color, 201);
    }

    public function destroy(DeviceColor $deviceColor): JsonResponse
    {
        $deviceColor->delete();

        return response()->json(['message' => 'Color eliminado']);
    }
}

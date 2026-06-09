<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(): JsonResponse
    {
        $suppliers = Supplier::query()
            ->orderBy('name')
            ->get();

        return response()->json($suppliers);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:suppliers,name'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $supplier = Supplier::create([
            'name' => strtoupper(trim($data['name'])),
            'contact_name' => isset($data['contact_name']) ? trim($data['contact_name']) : null,
            'phone' => $data['phone'] ?? null,
            'email' => isset($data['email']) ? strtolower(trim($data['email'])) : null,
            'city' => isset($data['city']) ? trim($data['city']) : null,
            'address' => isset($data['address']) ? trim($data['address']) : null,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json($supplier, 201);
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        $supplier->delete();

        return response()->json(['message' => 'Proveedor eliminado']);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    use DeniesReadOnlyInventoryRoles;

    public function index(): JsonResponse
    {
        $suppliers = Supplier::query()
            ->orderBy('name')
            ->get();

        return response()->json($suppliers);
    }

    public function store(Request $request): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:suppliers,name'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'department_code' => ['nullable', 'string', 'size:2', 'regex:/^\d{2}$/'],
            'municipality_code' => ['nullable', 'string', 'size:5', 'regex:/^\d{5}$/'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $supplier = Supplier::create([
            'name' => strtoupper(trim($data['name'])),
            'contact_name' => isset($data['contact_name']) ? trim($data['contact_name']) : null,
            'phone' => $data['phone'] ?? null,
            'email' => isset($data['email']) ? strtolower(trim($data['email'])) : null,
            'department_code' => $data['department_code'] ?? null,
            'municipality_code' => $data['municipality_code'] ?? null,
            'city' => isset($data['city']) ? trim($data['city']) : null,
            'address' => isset($data['address']) ? trim($data['address']) : null,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json($supplier, 201);
    }

    public function update(Request $request, Supplier $supplier): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100', Rule::unique('suppliers', 'name')->ignore($supplier->id)],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'department_code' => ['nullable', 'string', 'size:2', 'regex:/^\d{2}$/'],
            'municipality_code' => ['nullable', 'string', 'size:5', 'regex:/^\d{5}$/'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        if (array_key_exists('name', $data)) {
            $supplier->name = strtoupper(trim($data['name']));
        }
        if (array_key_exists('contact_name', $data)) {
            $supplier->contact_name = $data['contact_name'] !== null && $data['contact_name'] !== ''
                ? trim($data['contact_name'])
                : null;
        }
        if (array_key_exists('phone', $data)) {
            $supplier->phone = $data['phone'] ?: null;
        }
        if (array_key_exists('email', $data)) {
            $supplier->email = $data['email'] !== null && $data['email'] !== ''
                ? strtolower(trim($data['email']))
                : null;
        }
        if (array_key_exists('department_code', $data)) {
            $supplier->department_code = $data['department_code'] ?: null;
        }
        if (array_key_exists('municipality_code', $data)) {
            $supplier->municipality_code = $data['municipality_code'] ?: null;
        }
        if (array_key_exists('city', $data)) {
            $supplier->city = $data['city'] !== null && $data['city'] !== ''
                ? trim($data['city'])
                : null;
        }
        if (array_key_exists('address', $data)) {
            $supplier->address = $data['address'] !== null && $data['address'] !== ''
                ? trim($data['address'])
                : null;
        }
        if (array_key_exists('notes', $data)) {
            $supplier->notes = $data['notes'] ?: null;
        }

        $supplier->save();

        if ($supplier->wasChanged('name')) {
            InventoryItem::query()
                ->where('supplier_id', $supplier->id)
                ->update(['supplier' => $supplier->name]);
        }

        return response()->json($supplier->fresh());
    }

    public function destroy(Request $request, Supplier $supplier): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $supplier->delete();

        return response()->json(['message' => 'Proveedor eliminado']);
    }
}

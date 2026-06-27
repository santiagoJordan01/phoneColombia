<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Controller;
use App\Models\ServiceCustomer;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceCustomerController extends Controller
{
    use DeniesReadOnlyInventoryRoles;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $query = ServiceCustomer::query()->orderBy('name');

        if ($request->boolean('active_only', false)) {
            $query->where('is_active', true);
        }

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('phone', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('document', 'like', $term);
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->denyIfCannotManageCustomers($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'document' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $customer = ServiceCustomer::create([
            ...$data,
            'name' => trim($data['name']),
            'email' => isset($data['email']) ? strtolower(trim($data['email'])) : null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        $this->audit->log($customer, 'created', 'name', null, $customer->name);

        return response()->json($customer, 201);
    }

    public function update(Request $request, ServiceCustomer $serviceCustomer): JsonResponse
    {
        $this->denyIfCannotManageCustomers($request->user());

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'document' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (isset($data['name'])) {
            $data['name'] = trim($data['name']);
        }
        if (isset($data['email'])) {
            $data['email'] = $data['email'] ? strtolower(trim($data['email'])) : null;
        }

        $original = $serviceCustomer->getAttributes();
        $serviceCustomer->update($data);

        $changes = $serviceCustomer->getChanges();
        unset($changes['updated_at']);
        $this->audit->logChanges($serviceCustomer, $original, $changes);

        return response()->json($serviceCustomer->fresh());
    }

    public function destroy(Request $request, ServiceCustomer $serviceCustomer): JsonResponse
    {
        $this->denyIfCannotManageCustomers($request->user());
        $this->audit->log($serviceCustomer, 'deleted', 'name', $serviceCustomer->name, null);
        $serviceCustomer->delete();

        return response()->json(['message' => 'Cliente eliminado']);
    }
}

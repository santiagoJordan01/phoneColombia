<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Controller;
use App\Models\ServiceTechnician;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceTechnicianController extends Controller
{
    use DeniesReadOnlyInventoryRoles;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $query = ServiceTechnician::query()->orderBy('workshop')->orderBy('name');

        if ($request->boolean('active_only', false)) {
            $query->where('is_active', true);
        }

        if ($request->filled('workshop')) {
            $query->where('workshop', $request->string('workshop'));
        }

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('workshop', 'like', $term)
                    ->orWhere('phone', 'like', $term)
                    ->orWhere('email', 'like', $term);
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'workshop' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $technician = ServiceTechnician::create([
            ...$data,
            'name' => trim($data['name']),
            'workshop' => isset($data['workshop']) ? trim($data['workshop']) : null,
            'email' => isset($data['email']) ? strtolower(trim($data['email'])) : null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        $this->audit->log($technician, 'created', 'name', null, $technician->name);

        return response()->json($technician, 201);
    }

    public function update(Request $request, ServiceTechnician $serviceTechnician): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'workshop' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (isset($data['name'])) {
            $data['name'] = trim($data['name']);
        }
        if (array_key_exists('workshop', $data)) {
            $data['workshop'] = $data['workshop'] ? trim($data['workshop']) : null;
        }
        if (isset($data['email'])) {
            $data['email'] = $data['email'] ? strtolower(trim($data['email'])) : null;
        }

        $original = $serviceTechnician->getAttributes();
        $serviceTechnician->update($data);

        $changes = $serviceTechnician->getChanges();
        unset($changes['updated_at']);
        $this->audit->logChanges($serviceTechnician, $original, $changes);

        return response()->json($serviceTechnician->fresh());
    }

    public function destroy(Request $request, ServiceTechnician $serviceTechnician): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());
        $this->audit->log($serviceTechnician, 'deleted', 'name', $serviceTechnician->name, null);
        $serviceTechnician->delete();

        return response()->json(['message' => 'Técnico eliminado']);
    }
}

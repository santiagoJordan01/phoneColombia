<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Controller;
use App\Models\ServiceTicket;
use App\Models\ServiceTicketState;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ServiceTicketStateController extends Controller
{
    use DeniesReadOnlyInventoryRoles;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $query = ServiceTicketState::query()->orderBy('sort_order')->orderBy('name');

        if ($request->boolean('active_only', false)) {
            $query->where('is_active', true);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:60', 'alpha_dash', Rule::unique('service_ticket_states', 'slug')],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'marks_in_service' => ['nullable', 'boolean'],
            'releases_inventory' => ['nullable', 'boolean'],
        ]);

        $slug = $data['slug'] ?? Str::slug($data['name'], '_');

        if ($data['is_default'] ?? false) {
            ServiceTicketState::query()->update(['is_default' => false]);
        }

        $state = ServiceTicketState::create([
            'name' => trim($data['name']),
            'slug' => $slug,
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
            'is_default' => $data['is_default'] ?? false,
            'marks_in_service' => $data['marks_in_service'] ?? false,
            'releases_inventory' => $data['releases_inventory'] ?? false,
        ]);

        $this->audit->log($state, 'created', 'name', null, $state->name);

        return response()->json($state, 201);
    }

    public function update(Request $request, ServiceTicketState $serviceTicketState): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:60', 'alpha_dash', Rule::unique('service_ticket_states', 'slug')->ignore($serviceTicketState->id)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'marks_in_service' => ['nullable', 'boolean'],
            'releases_inventory' => ['nullable', 'boolean'],
        ]);

        if (isset($data['name'])) {
            $data['name'] = trim($data['name']);
        }

        if (array_key_exists('slug', $data) && $data['slug'] !== $serviceTicketState->slug) {
            $inUse = ServiceTicket::query()->where('status', $serviceTicketState->slug)->exists();
            if ($inUse) {
                return response()->json([
                    'message' => 'No se puede cambiar el código: hay tickets usando este estado.',
                ], 422);
            }
        }

        if ($data['is_default'] ?? false) {
            ServiceTicketState::query()
                ->where('id', '!=', $serviceTicketState->id)
                ->update(['is_default' => false]);
        }

        $original = $serviceTicketState->getAttributes();
        $serviceTicketState->update($data);

        $changes = $serviceTicketState->getChanges();
        unset($changes['updated_at']);
        $this->audit->logChanges($serviceTicketState, $original, $changes);

        return response()->json($serviceTicketState->fresh());
    }

    public function destroy(Request $request, ServiceTicketState $serviceTicketState): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        if ($serviceTicketState->is_default) {
            return response()->json(['message' => 'No se puede eliminar el estado inicial por defecto.'], 422);
        }

        if (ServiceTicket::query()->where('status', $serviceTicketState->slug)->exists()) {
            return response()->json(['message' => 'Hay tickets con este estado. Desactívalo en lugar de eliminarlo.'], 422);
        }

        $this->audit->log($serviceTicketState, 'deleted', 'name', $serviceTicketState->name, null);
        $serviceTicketState->delete();

        return response()->json(['message' => 'Estado eliminado']);
    }
}

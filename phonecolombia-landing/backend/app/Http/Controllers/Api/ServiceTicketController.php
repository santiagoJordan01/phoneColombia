<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\ServiceCategory;
use App\Models\ServiceCustomer;
use App\Models\ServiceTechnician;
use App\Models\ServiceTicket;
use App\Models\User;
use App\Services\AuditService;
use App\Services\InventoryMovementService;
use App\Support\InventoryStatus;
use App\Support\InventoryStatusGuard;
use App\Support\ServiceTicketAccess;
use App\Support\ServiceTicketCategory;
use App\Support\ServiceTicketStateCatalog;
use App\Support\ServiceTicketStatus;
use App\Support\ServiceTicketType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ServiceTicketController extends Controller
{
    use DeniesReadOnlyInventoryRoles, ScopesInventoryForUser;

    public function __construct(
        private InventoryMovementService $movements,
        private AuditService $audit,
    ) {}

    public function technicians(): JsonResponse
    {
        $users = User::query()
            ->whereIn('role', [
                User::ROLE_INVENTORY,
                User::ROLE_SUPER_ADMIN,
                User::ROLE_SELLER,
                User::ROLE_ASESOR,
                User::ROLE_SERVICE_TECHNICIAN,
            ])
            ->orderBy('name')
            ->get(['id', 'name', 'role']);

        return response()->json($users);
    }

    public function workshops(): JsonResponse
    {
        $categories = ServiceCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'slug']);

        $technicians = ServiceTechnician::query()
            ->where('is_active', true)
            ->orderBy('workshop')
            ->orderBy('name')
            ->get(['id', 'name', 'workshop', 'phone']);

        $workshopNames = $technicians->pluck('workshop')->filter()->unique()->values()->all();

        return response()->json([
            'workshops' => $workshopNames,
            'categories' => $categories->pluck('name', 'slug')->all(),
            'category_options' => $categories,
            'technician_options' => $technicians,
            'ticket_types' => [
                ServiceTicketType::INVENTARIO => 'Equipo de inventario',
                ServiceTicketType::CLIENTE_EXTERNO => 'Equipo de cliente',
                ServiceTicketType::GARANTIA => 'Garantía',
            ],
            'statuses' => ServiceTicketStateCatalog::labelsMap(),
            'status_options' => ServiceTicketStateCatalog::active()->values(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = ServiceTicket::query()
            ->with(['inventoryItem', 'assignedUser', 'creator', 'serviceCustomer', 'serviceCategory', 'serviceTechnician'])
            ->orderByDesc('received_at');

        ServiceTicketAccess::scopeForUser($query, $user);

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('workshop')) {
            $query->where('workshop', $request->string('workshop'));
        }

        if ($request->filled('ticket_type')) {
            $query->where('ticket_type', $request->string('ticket_type'));
        }

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('device_name', 'like', $term)
                    ->orWhere('device_reference', 'like', $term)
                    ->orWhere('issue_description', 'like', $term)
                    ->orWhere('customer_name', 'like', $term)
                    ->orWhereHas('inventoryItem', function ($itemQuery) use ($term) {
                        $itemQuery->where('name', 'like', $term)
                            ->orWhere('imei', 'like', $term)
                            ->orWhere('barcode', 'like', $term);
                    })
                    ->orWhereHas('serviceCustomer', fn ($c) => $c->where('name', 'like', $term));
            });
        }

        return response()->json($query->get()->map(fn (ServiceTicket $ticket) => $this->serializeTicket($ticket)));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->denyIfCannotCreateServiceTicket($user);

        $data = $this->validateTicketData($request);
        $isWarranty = $data['ticket_type'] === ServiceTicketType::GARANTIA || ($data['is_warranty'] ?? false);
        $this->applyCatalogRelations($data);

        $item = null;
        if (! empty($data['inventory_item_id'])) {
            $item = InventoryItem::findOrFail($data['inventory_item_id']);
            InventoryStatusGuard::assertAvailableForServiceTicket($item);
        }

        $defaultSlug = ServiceTicketStateCatalog::defaultSlug();
        $defaultState = ServiceTicketStateCatalog::findBySlug($defaultSlug);

        $ticket = ServiceTicket::create([
            ...$data,
            'is_warranty' => $isWarranty,
            'created_by' => $user->id,
            'status' => $defaultSlug,
            'received_at' => $data['received_at'] ?? now(),
        ]);

        if ($item && $defaultState?->marks_in_service) {
            $this->markItemInService($item, $ticket);
        }

        $this->audit->log($ticket, 'created');

        return response()->json($this->serializeTicket($ticket->load([
            'inventoryItem', 'assignedUser', 'creator', 'serviceCustomer', 'serviceCategory', 'serviceTechnician',
        ])), 201);
    }

    public function update(Request $request, ServiceTicket $serviceTicket): JsonResponse
    {
        $user = $request->user();
        $this->denyIfCannotUpdateServiceTicket($user, $serviceTicket);

        $rules = [
            'assigned_user_id' => ['nullable', 'exists:users,id'],
            'service_customer_id' => ['nullable', 'uuid', 'exists:service_customers,id'],
            'service_category_id' => ['nullable', 'uuid', 'exists:service_categories,id'],
            'service_technician_id' => ['nullable', 'uuid', 'exists:service_technicians,id'],
            'workshop' => ['nullable', 'string', 'max:120'],
            'status' => ['sometimes', Rule::in(ServiceTicketStateCatalog::activeSlugs())],
            'issue_description' => ['sometimes', 'string'],
            'service_category' => ['nullable', Rule::in(ServiceTicketCategory::ALL)],
            'repair_notes' => ['nullable', 'string'],
            'repair_cost' => ['nullable', 'numeric', 'min:0'],
            'customer_price' => ['nullable', 'numeric', 'min:0'],
            'is_warranty' => ['sometimes', 'boolean'],
            'customer_name' => ['nullable', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'device_name' => ['nullable', 'string', 'max:200'],
            'device_reference' => ['nullable', 'string', 'max:64'],
            'delivered_at' => ['nullable', 'date'],
        ];

        $data = $request->validate($rules);

        $this->applyCatalogRelations($data);

        $newStatus = $data['status'] ?? null;
        $hadDeliveredAt = $serviceTicket->delivered_at !== null;
        $original = $serviceTicket->getAttributes();

        $serviceTicket->update($data);

        $changes = $serviceTicket->getChanges();
        unset($changes['updated_at']);
        $this->audit->logChanges($serviceTicket, $original, $changes);

        $state = $newStatus ? ServiceTicketStateCatalog::findBySlug($newStatus) : null;

        if ($state?->marks_in_service) {
            $item = $serviceTicket->inventoryItem;
            if ($item && $item->status !== InventoryStatus::SERVICIO_TECNICO) {
                $this->markItemInService($item, $serviceTicket);
            }
        }

        if ($state?->releases_inventory && ! $hadDeliveredAt) {
            $serviceTicket->update(['delivered_at' => $data['delivered_at'] ?? now()]);
            $item = $serviceTicket->inventoryItem;
            if ($item && $item->status === InventoryStatus::SERVICIO_TECNICO) {
                $this->releaseItemFromService($item, $serviceTicket);
            }
        }

        return response()->json($this->serializeTicket($serviceTicket->fresh()->load([
            'inventoryItem', 'assignedUser', 'creator', 'serviceCustomer', 'serviceCategory', 'serviceTechnician',
        ])));
    }

    /** @return array<string, mixed> */
    private function validateTicketData(Request $request): array
    {
        $data = $request->validate([
            'ticket_type' => ['required', Rule::in(ServiceTicketType::ALL)],
            'inventory_item_id' => ['nullable', 'uuid', 'exists:inventory_items,id'],
            'service_customer_id' => ['nullable', 'uuid', 'exists:service_customers,id'],
            'service_category_id' => ['nullable', 'uuid', 'exists:service_categories,id'],
            'service_technician_id' => ['nullable', 'uuid', 'exists:service_technicians,id'],
            'device_name' => ['nullable', 'string', 'max:200'],
            'device_reference' => ['nullable', 'string', 'max:64'],
            'assigned_user_id' => ['nullable', 'exists:users,id'],
            'workshop' => ['nullable', 'string', 'max:120'],
            'issue_description' => ['required', 'string'],
            'service_category' => ['nullable', Rule::in(ServiceTicketCategory::ALL)],
            'repair_notes' => ['nullable', 'string'],
            'repair_cost' => ['nullable', 'numeric', 'min:0'],
            'customer_price' => ['nullable', 'numeric', 'min:0'],
            'is_warranty' => ['nullable', 'boolean'],
            'customer_name' => ['nullable', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'received_at' => ['nullable', 'date'],
        ]);

        if ($data['ticket_type'] === ServiceTicketType::INVENTARIO && empty($data['inventory_item_id'])) {
            throw ValidationException::withMessages([
                'inventory_item_id' => ['Selecciona un equipo del inventario.'],
            ]);
        }

        if ($data['ticket_type'] === ServiceTicketType::CLIENTE_EXTERNO && empty($data['device_name']) && empty($data['service_customer_id'])) {
            throw ValidationException::withMessages([
                'device_name' => ['Indica el equipo o selecciona un cliente registrado.'],
            ]);
        }

        if ($data['ticket_type'] === ServiceTicketType::GARANTIA && empty($data['inventory_item_id']) && empty($data['device_name'])) {
            throw ValidationException::withMessages([
                'device_name' => ['Indica el equipo de garantía (inventario o descripción).'],
            ]);
        }

        return $data;
    }

    /** @param array<string, mixed> $data */
    private function applyCatalogRelations(array &$data): void
    {
        if (! empty($data['service_customer_id'])) {
            $customer = ServiceCustomer::find($data['service_customer_id']);
            if ($customer) {
                $data['customer_name'] = $customer->name;
                $data['customer_phone'] = $customer->phone;
            }
        }

        if (! empty($data['service_category_id'])) {
            $category = ServiceCategory::find($data['service_category_id']);
            if ($category) {
                $data['service_category'] = $category->slug;
            }
        }

        if (! empty($data['service_technician_id'])) {
            $technician = ServiceTechnician::find($data['service_technician_id']);
            if ($technician) {
                $data['workshop'] = $technician->workshop ?: $technician->name;
            }
        }
    }

    private function markItemInService(InventoryItem $item, ServiceTicket $ticket): void
    {
        $oldStatus = $item->status;
        if ($oldStatus === InventoryStatus::SERVICIO_TECNICO) {
            return;
        }

        $item->update(['status' => InventoryStatus::SERVICIO_TECNICO]);
        $this->movements->record(
            $item,
            'status_change',
            'status',
            $oldStatus,
            InventoryStatus::SERVICIO_TECNICO,
            'Ingreso a servicio técnico',
            [
                'ticket_id' => $ticket->id,
                'ticket_status' => $ticket->status,
            ],
        );
    }

    private function releaseItemFromService(InventoryItem $item, ServiceTicket $ticket): void
    {
        $oldStatus = $item->status;
        $item->update(['status' => InventoryStatus::DISPONIBLE]);
        $this->movements->record(
            $item,
            'status_change',
            'status',
            $oldStatus,
            InventoryStatus::DISPONIBLE,
            'Entrega de servicio técnico',
            [
                'ticket_id' => $ticket->id,
                'ticket_status' => $ticket->status,
            ],
        );
    }

    private function serializeTicket(ServiceTicket $ticket): array
    {
        $item = $ticket->inventoryItem;

        return [
            'id' => $ticket->id,
            'ticket_type' => $ticket->ticket_type,
            'inventory_item_id' => $ticket->inventory_item_id,
            'service_customer_id' => $ticket->service_customer_id,
            'service_category_id' => $ticket->service_category_id,
            'service_technician_id' => $ticket->service_technician_id,
            'device_name' => $ticket->device_name,
            'device_reference' => $ticket->device_reference,
            'display_name' => $ticket->displayName(),
            'assigned_user_id' => $ticket->assigned_user_id,
            'workshop' => $ticket->workshop,
            'created_by' => $ticket->created_by,
            'status' => $ticket->status,
            'issue_description' => $ticket->issue_description,
            'service_category' => $ticket->service_category,
            'category' => $ticket->serviceCategory ? [
                'id' => $ticket->serviceCategory->id,
                'name' => $ticket->serviceCategory->name,
                'slug' => $ticket->serviceCategory->slug,
            ] : null,
            'repair_notes' => $ticket->repair_notes,
            'repair_cost' => $ticket->repair_cost,
            'customer_price' => $ticket->customer_price,
            'is_warranty' => $ticket->is_warranty,
            'customer_name' => $ticket->customer_name,
            'customer_phone' => $ticket->customer_phone,
            'received_at' => $ticket->received_at?->toIso8601String(),
            'delivered_at' => $ticket->delivered_at?->toIso8601String(),
            'created_at' => $ticket->created_at?->toIso8601String(),
            'updated_at' => $ticket->updated_at?->toIso8601String(),
            'inventory_item' => $item ? [
                'id' => $item->id,
                'name' => $item->name,
                'imei' => $item->imei,
                'barcode' => $item->barcode,
                'status' => $item->status,
            ] : null,
            'service_customer' => $ticket->serviceCustomer ? [
                'id' => $ticket->serviceCustomer->id,
                'name' => $ticket->serviceCustomer->name,
                'phone' => $ticket->serviceCustomer->phone,
            ] : null,
            'service_technician' => $ticket->serviceTechnician ? [
                'id' => $ticket->serviceTechnician->id,
                'name' => $ticket->serviceTechnician->name,
                'workshop' => $ticket->serviceTechnician->workshop,
                'phone' => $ticket->serviceTechnician->phone,
            ] : null,
            'assigned_user' => $ticket->assignedUser ? [
                'id' => $ticket->assignedUser->id,
                'name' => $ticket->assignedUser->name,
            ] : null,
            'creator' => $ticket->creator ? [
                'id' => $ticket->creator->id,
                'name' => $ticket->creator->name,
            ] : null,
        ];
    }
}

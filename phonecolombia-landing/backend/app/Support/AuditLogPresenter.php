<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\ServiceCategory;
use App\Models\ServiceCustomer;
use App\Models\ServiceTechnician;
use App\Models\ServiceTicket;
use App\Models\ServiceTicketState;
use App\Models\User;
use Illuminate\Support\Collection;

class AuditLogPresenter
{
    public const ENTITY_KEYS = [
        InventoryItem::class => 'inventory',
        Sale::class => 'sale',
        User::class => 'user',
        ServiceTicket::class => 'service_ticket',
        ServiceCustomer::class => 'service_customer',
        ServiceTechnician::class => 'service_technician',
        ServiceCategory::class => 'service_category',
        ServiceTicketState::class => 'service_ticket_state',
        'system' => 'system',
    ];

    private const ENTITY_LABELS = [
        InventoryItem::class => 'Equipo',
        Sale::class => 'Venta',
        User::class => 'Usuario',
        ServiceTicket::class => 'Servicio técnico',
        ServiceCustomer::class => 'Cliente ST',
        ServiceTechnician::class => 'Técnico ST',
        ServiceCategory::class => 'Categoría ST',
        ServiceTicketState::class => 'Estado ST',
        'system' => 'Sistema',
    ];

    private const ACTION_LABELS = [
        'created' => 'Creación',
        'updated' => 'Actualización',
        'deleted' => 'Eliminación',
        'soft_deleted' => 'Archivado',
        'retake' => 'Retoma',
        'returned' => 'Devolución por retoma',
        'reingreso' => 'Reingreso',
        'payment_added' => 'Abono registrado',
        'import' => 'Importación',
    ];

    private const FIELD_LABELS = [
        'status' => 'Estado',
        'name' => 'Nombre',
        'imei' => 'IMEI',
        'barcode' => 'Código de barras',
        'color' => 'Color',
        'supplier' => 'Proveedor',
        'supplier_id' => 'Proveedor',
        'purchase_price' => 'Precio compra',
        'sale_price' => 'Precio venta',
        'battery' => 'Batería',
        'notes' => 'Notas',
        'role' => 'Rol',
        'email' => 'Correo',
        'amount_paid' => 'Monto pagado',
        'credit_status' => 'Estado crédito',
        'payment_method' => 'Método de pago',
        'assigned_user_id' => 'Técnico asignado',
        'repair_notes' => 'Notas de reparación',
        'issue_description' => 'Descripción del fallo',
        'workshop' => 'Taller',
        'service_category' => 'Categoría',
        'repair_cost' => 'Costo reparación',
        'customer_price' => 'Precio cliente',
        'device_name' => 'Equipo',
        'device_reference' => 'Referencia / IMEI',
        'ticket_type' => 'Tipo de ticket',
        'is_warranty' => 'Garantía',
        'customer_name' => 'Cliente',
        'customer_phone' => 'Teléfono cliente',
    ];

    private const STATUS_LABELS = [
        'disponible' => 'DISPONIBLE',
        'vendido' => 'VENDIDO',
        'retomado' => 'RETOMADO',
        'separado' => 'SEPARADO',
        'servicio_tecnico' => 'SERVICIO TÉCNICO',
        'archived' => 'ARCHIVADO',
        'paid' => 'PAGADO',
        'pending' => 'PENDIENTE',
        'returned' => 'DEVUELTO',
        'proceso_revision' => 'PROCESO DE REVISIÓN',
        'esperando_repuestos' => 'ESPERANDO REPUESTOS',
        'servicio_tecnico' => 'SERVICIO TÉCNICO',
        'servicio_realizado' => 'SERVICIO REALIZADO',
        'en_revision' => 'PROCESO DE REVISIÓN',
        'en_reparacion' => 'SERVICIO TÉCNICO',
        'listo' => 'SERVICIO REALIZADO',
        'entregado' => 'SERVICIO REALIZADO',
    ];

    private const ROLE_LABELS = [
        User::ROLE_SUPER_ADMIN => 'Administrador principal',
        User::ROLE_CONTENT => 'Contenido',
        User::ROLE_INVENTORY => 'Inventario',
        User::ROLE_SELLER => 'Vendedor',
        User::ROLE_ASESOR => 'Asesor',
        User::ROLE_SERVICE_TECHNICIAN => 'Técnico ST',
        User::ROLE_SUPPLIER => 'Proveedor',
        User::ROLE_ACCOUNTANT => 'Contador',
    ];

    /** @param Collection<int, AuditLog> $logs */
    public function presentCollection(Collection $logs): array
    {
        $context = $this->buildContext($logs);

        return $logs->map(fn (AuditLog $log) => $this->present($log, $context))->all();
    }

    /** @param Collection<int, AuditLog> $logs */
    public function summarize(Collection $logs): array
    {
        $byAction = [];
        foreach ($logs->groupBy('action') as $action => $group) {
            $byAction[$action] = [
                'count' => $group->count(),
                'label' => self::ACTION_LABELS[$action] ?? $action,
            ];
        }

        $byEntity = [];
        foreach ($logs->groupBy('auditable_type') as $type => $group) {
            $key = self::ENTITY_KEYS[$type] ?? $type;
            $byEntity[$key] = [
                'count' => $group->count(),
                'label' => self::ENTITY_LABELS[$type] ?? $type,
            ];
        }

        return [
            'total' => $logs->count(),
            'by_action' => $byAction,
            'by_entity' => $byEntity,
        ];
    }

    public static function filterOptions(): array
    {
        return [
            'actions' => collect(self::ACTION_LABELS)
                ->map(fn ($label, $value) => ['value' => $value, 'label' => $label])
                ->values()
                ->all(),
            'entities' => collect(self::ENTITY_KEYS)
                ->map(fn ($value, $type) => [
                    'value' => $value,
                    'label' => self::ENTITY_LABELS[$type] ?? $type,
                ])
                ->values()
                ->unique('value')
                ->values()
                ->all(),
        ];
    }

    /** @param array<string, mixed> $context */
    private function present(AuditLog $log, array $context): array
    {
        $entityKey = self::ENTITY_KEYS[$log->auditable_type] ?? $log->auditable_type;
        $entityLabel = self::ENTITY_LABELS[$log->auditable_type] ?? $log->auditable_type;
        $actionLabel = self::ACTION_LABELS[$log->action] ?? $log->action;
        $fieldLabel = $log->field ? (self::FIELD_LABELS[$log->field] ?? $log->field) : null;
        $entitySummary = $this->resolveEntitySummary($log, $context);
        $oldDisplay = $this->formatValue($log->field, $log->old_value);
        $newDisplay = $this->formatValue($log->field, $log->new_value);

        return [
            'id' => $log->id,
            'created_at' => $log->created_at,
            'user_id' => $log->user_id,
            'user' => $log->user ? [
                'id' => $log->user->id,
                'name' => $log->user->name,
                'email' => $log->user->email,
                'role' => $log->user->resolvedRole(),
                'role_label' => self::ROLE_LABELS[$log->user->resolvedRole() ?? ''] ?? $log->user->resolvedRole(),
            ] : null,
            'auditable_type' => $log->auditable_type,
            'auditable_id' => $log->auditable_id,
            'entity_key' => $entityKey,
            'entity_label' => $entityLabel,
            'entity_summary' => $entitySummary,
            'action' => $log->action,
            'action_label' => $actionLabel,
            'field' => $log->field,
            'field_label' => $fieldLabel,
            'old_value' => $log->old_value,
            'new_value' => $log->new_value,
            'old_value_display' => $oldDisplay,
            'new_value_display' => $newDisplay,
            'meta' => $log->meta,
            'meta_summary' => $this->formatMetaSummary($log),
            'description' => $this->buildDescription(
                $log,
                $actionLabel,
                $fieldLabel,
                $entityLabel,
                $entitySummary,
                $oldDisplay,
                $newDisplay,
            ),
        ];
    }

    /** @param Collection<int, AuditLog> $logs */
    private function buildContext(Collection $logs): array
    {
        $byType = $logs->groupBy('auditable_type');

        $itemIds = $byType->get(InventoryItem::class, collect())->pluck('auditable_id')->filter()->unique();
        $saleIds = $byType->get(Sale::class, collect())->pluck('auditable_id')->filter()->unique();
        $userIds = $byType->get(User::class, collect())->pluck('auditable_id')->filter()->unique();
        $ticketIds = $byType->get(ServiceTicket::class, collect())->pluck('auditable_id')->filter()->unique();

        return [
            'items' => $itemIds->isEmpty()
                ? collect()
                : InventoryItem::withTrashed()->whereIn('id', $itemIds)->get()->keyBy('id'),
            'sales' => $saleIds->isEmpty()
                ? collect()
                : Sale::with('inventoryItem')->whereIn('id', $saleIds)->get()->keyBy('id'),
            'users' => $userIds->isEmpty()
                ? collect()
                : User::query()->whereIn('id', $userIds)->get()->keyBy('id'),
            'tickets' => $ticketIds->isEmpty()
                ? collect()
                : ServiceTicket::with('inventoryItem')->whereIn('id', $ticketIds)->get()->keyBy('id'),
        ];
    }

    /** @param array<string, mixed> $context */
    private function resolveEntitySummary(AuditLog $log, array $context): ?string
    {
        if ($log->auditable_type === 'system') {
            return 'Evento global';
        }

        $id = $log->auditable_id;

        return match ($log->auditable_type) {
            InventoryItem::class => $this->itemLabel($context['items'][$id] ?? null, $id),
            Sale::class => $this->saleLabel($context['sales'][$id] ?? null, $id),
            User::class => $this->userLabel($context['users'][$id] ?? null, $id),
            ServiceTicket::class => $this->ticketLabel($context['tickets'][$id] ?? null, $id),
            ServiceCustomer::class, ServiceTechnician::class, ServiceCategory::class, ServiceTicketState::class => $this->catalogLabel($log),
            default => $id !== '0' ? $id : null,
        };
    }

    private function catalogLabel(AuditLog $log): string
    {
        $name = $log->new_value ?: $log->old_value;

        return $name ? (string) $name : '#'.$log->auditable_id;
    }

    private function itemLabel(?InventoryItem $item, string $id): string
    {
        if (! $item) {
            return "Equipo #{$id}";
        }

        $parts = array_filter([$item->name, $item->imei ? "IMEI {$item->imei}" : null]);

        return implode(' · ', $parts) ?: "Equipo #{$id}";
    }

    private function saleLabel(?Sale $sale, string $id): string
    {
        if (! $sale) {
            return "Venta #{$id}";
        }

        $itemName = $sale->inventoryItem?->name;
        $price = $sale->sale_price ? number_format((float) $sale->sale_price, 0, ',', '.') : null;

        return collect([$itemName, $price ? "\${$price}" : null])->filter()->implode(' · ') ?: "Venta #{$id}";
    }

    private function userLabel(?User $user, string $id): string
    {
        if (! $user) {
            return "Usuario #{$id}";
        }

        return "{$user->name} ({$user->email})";
    }

    private function ticketLabel(?ServiceTicket $ticket, string $id): string
    {
        if (! $ticket) {
            return "Ticket #{$id}";
        }

        $itemName = $ticket->inventoryItem?->name ?? $ticket->device_name;

        return $itemName ? "ST · {$itemName}" : "Ticket #{$id}";
    }

    private function formatValue(?string $field, mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $stringValue = (string) $value;

        if ($field === 'status' || $field === 'credit_status') {
            return self::STATUS_LABELS[$stringValue] ?? strtoupper(str_replace('_', ' ', $stringValue));
        }

        if ($field === 'role') {
            return self::ROLE_LABELS[$stringValue] ?? $stringValue;
        }

        if (in_array($field, ['purchase_price', 'sale_price', 'amount_paid', 'repair_cost', 'customer_price'], true) && is_numeric($stringValue)) {
            return '$'.number_format((float) $stringValue, 0, ',', '.');
        }

        return $stringValue;
    }

    private function formatMetaSummary(AuditLog $log): ?string
    {
        if (! is_array($log->meta) || $log->meta === []) {
            return null;
        }

        if ($log->action === 'import') {
            $created = $log->meta['created'] ?? 0;
            $skipped = $log->meta['skipped'] ?? 0;
            $errors = count($log->meta['errors'] ?? []);

            return "{$created} creados, {$skipped} omitidos".($errors > 0 ? ", {$errors} errores" : '');
        }

        if ($log->action === 'deleted' && isset($log->meta['email'])) {
            return "Correo: {$log->meta['email']}";
        }

        return collect($log->meta)
            ->map(fn ($v, $k) => is_scalar($v) ? "{$k}: {$v}" : "{$k}: ".json_encode($v, JSON_UNESCAPED_UNICODE))
            ->implode(' · ');
    }

    private function buildDescription(
        AuditLog $log,
        string $actionLabel,
        ?string $fieldLabel,
        string $entityLabel,
        ?string $entitySummary,
        ?string $oldDisplay,
        ?string $newDisplay,
    ): string {
        $target = $entitySummary ? "{$entityLabel}: {$entitySummary}" : $entityLabel;

        if ($log->action === 'import') {
            return "{$actionLabel} de inventario".($this->formatMetaSummary($log) ? " ({$this->formatMetaSummary($log)})" : '');
        }

        if ($log->action === 'created') {
            return "{$actionLabel} de {$target}";
        }

        if ($log->action === 'soft_deleted') {
            return "Archivó {$target}";
        }

        if ($log->action === 'deleted') {
            return "Eliminó {$target}";
        }

        if ($log->action === 'payment_added') {
            return "Registró abono en {$target}".($newDisplay ? " → {$newDisplay}" : '');
        }

        if ($fieldLabel && $oldDisplay && $newDisplay) {
            return "{$actionLabel} en {$target}: {$fieldLabel} de {$oldDisplay} a {$newDisplay}";
        }

        if ($fieldLabel && $newDisplay) {
            return "{$actionLabel} en {$target}: {$fieldLabel} → {$newDisplay}";
        }

        if ($fieldLabel) {
            return "{$actionLabel} en {$target}: {$fieldLabel}";
        }

        return "{$actionLabel} en {$target}";
    }
}

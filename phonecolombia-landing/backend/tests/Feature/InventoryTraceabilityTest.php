<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\CreditPaymentMethod;
use App\Models\InventoryItem;
use Database\Seeders\CreditPaymentMethodSeeder;
use App\Models\InventoryMovement;
use App\Models\Sale;
use App\Models\ServiceTicket;
use App\Models\User;
use App\Support\InventoryStatus;
use App\Support\ServiceTicketStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InventoryTraceabilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CreditPaymentMethodSeeder::class);
    }

    /** @return array{0: User, 1: string} */
    private function actingAsRole(string $role, array $extra = []): array
    {
        $user = User::factory()->create(array_merge([
            'password' => Hash::make('password'),
            'role' => $role,
            'is_admin' => $role === User::ROLE_SUPER_ADMIN,
        ], $extra));

        return [$user, $user->createToken('test')->plainTextToken];
    }

    private function tokenForUser(User $user, string $name = 'test'): string
    {
        $this->app['auth']->guard('sanctum')->forgetUser();

        return $user->createToken($name)->plainTextToken;
    }

    private function createItem(array $overrides = []): InventoryItem
    {
        return InventoryItem::create(array_merge([
            'name' => 'IPHONE 13 128GB',
            'imei' => '352099001761481',
            'sale_price' => '3200000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ], $overrides));
    }

    public function test_create_item_records_ingreso_movement_and_created_audit_with_user(): void
    {
        [$user, $token] = $this->actingAsRole(User::ROLE_INVENTORY);

        $response = $this->withToken($token)
            ->postJson('/api/inventory', [
                'name' => 'IPHONE 15 PRO',
                'imei' => '999888777666555',
                'sale_price' => '4500000',
                'status' => InventoryStatus::DISPONIBLE,
            ]);

        $response->assertCreated();
        $itemId = $response->json('id');

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $itemId,
            'user_id' => $user->id,
            'type' => 'ingreso',
            'new_value' => InventoryStatus::DISPONIBLE,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'auditable_type' => InventoryItem::class,
            'auditable_id' => $itemId,
            'action' => 'created',
        ]);
    }

    public function test_update_item_records_field_movement_and_audit_per_changed_field(): void
    {
        [$user, $token] = $this->actingAsRole(User::ROLE_INVENTORY);
        $item = $this->createItem(['sale_price' => '3000000']);

        $this->withToken($token)
            ->putJson("/api/inventory/{$item->id}", ['sale_price' => '3500000'])
            ->assertOk();

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'user_id' => $user->id,
            'type' => 'field_update',
            'field' => 'sale_price',
            'old_value' => '3000000',
            'new_value' => '3500000',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'auditable_type' => InventoryItem::class,
            'auditable_id' => $item->id,
            'action' => 'updated',
            'field' => 'sale_price',
            'old_value' => '3000000',
            'new_value' => '3500000',
        ]);
    }

    public function test_archive_item_records_archived_movement_and_soft_deleted_audit(): void
    {
        [$user, $token] = $this->actingAsRole(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $this->withToken($token)
            ->deleteJson("/api/inventory/{$item->id}")
            ->assertOk();

        $this->assertSoftDeleted('inventory_items', ['id' => $item->id]);

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'user_id' => $user->id,
            'type' => 'archived',
            'field' => 'status',
            'new_value' => 'archived',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'auditable_type' => InventoryItem::class,
            'auditable_id' => $item->id,
            'action' => 'soft_deleted',
        ]);
    }

    public function test_archived_inventory_can_be_listed_and_shown(): void
    {
        [, $token] = $this->actingAsRole(User::ROLE_INVENTORY);
        $archived = $this->createItem(['name' => 'IPHONE ARCHIVADO', 'imei' => '111111111111111']);
        $active = $this->createItem(['name' => 'IPHONE ACTIVO', 'imei' => '222222222222222']);

        $this->withToken($token)
            ->deleteJson("/api/inventory/{$archived->id}")
            ->assertOk();

        $this->withToken($token)
            ->getJson('/api/inventory')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $active->id);

        $this->withToken($token)
            ->getJson('/api/inventory?archived=1')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $archived->id)
            ->assertJsonPath('0.is_archived', true)
            ->assertJsonPath('0.deleted_at', fn ($value) => $value !== null);

        $this->withToken($token)
            ->getJson("/api/inventory/{$archived->id}")
            ->assertOk()
            ->assertJsonPath('id', $archived->id)
            ->assertJsonPath('is_archived', true)
            ->assertJsonPath('movements.0.type', 'archived');
    }

    public function test_retake_flow_records_movements_and_audit_in_sequence(): void
    {
        [$user, $token] = $this->actingAsRole(User::ROLE_INVENTORY);
        $item = $this->createItem(['status' => InventoryStatus::VENDIDO]);

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/retake")
            ->assertOk()
            ->assertJsonPath('status', InventoryStatus::RETOMADO);

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'user_id' => $user->id,
            'type' => 'retoma',
            'old_value' => InventoryStatus::VENDIDO,
            'new_value' => InventoryStatus::RETOMADO,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'auditable_id' => $item->id,
            'action' => 'retake',
            'field' => 'status',
            'old_value' => InventoryStatus::VENDIDO,
            'new_value' => InventoryStatus::RETOMADO,
        ]);

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/retake")
            ->assertOk()
            ->assertJsonPath('status', InventoryStatus::DISPONIBLE);

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'user_id' => $user->id,
            'type' => 'reingreso',
            'old_value' => InventoryStatus::RETOMADO,
            'new_value' => InventoryStatus::DISPONIBLE,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'auditable_id' => $item->id,
            'action' => 'reingreso',
            'field' => 'status',
            'old_value' => InventoryStatus::RETOMADO,
            'new_value' => InventoryStatus::DISPONIBLE,
        ]);

        $movementCount = InventoryMovement::query()
            ->where('inventory_item_id', $item->id)
            ->whereIn('type', ['retoma', 'reingreso'])
            ->count();
        $this->assertSame(2, $movementCount);
    }

    public function test_sale_records_venta_movement_sale_audit_and_seller_user_id(): void
    {
        [$seller, $token] = $this->actingAsRole(User::ROLE_SELLER);
        $item = $this->createItem();

        $response = $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '3200000',
                'payment_method' => 'efectivo',
            ]);

        $response->assertCreated();
        $saleId = $response->json('id');

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'user_id' => $seller->id,
            'inventory_item_id' => $item->id,
        ]);

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'user_id' => $seller->id,
            'type' => 'venta',
            'field' => 'status',
            'old_value' => InventoryStatus::DISPONIBLE,
            'new_value' => InventoryStatus::VENDIDO,
        ]);

        $movement = InventoryMovement::query()
            ->where('inventory_item_id', $item->id)
            ->where('type', 'venta')
            ->first();

        $this->assertNotNull($movement);
        $this->assertSame($saleId, $movement->meta['sale_id'] ?? null);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $seller->id,
            'auditable_type' => Sale::class,
            'auditable_id' => $saleId,
            'action' => 'created',
        ]);
    }

    public function test_add_payment_records_payment_added_audit(): void
    {
        [$seller, $token] = $this->actingAsRole(User::ROLE_SELLER);
        $item = $this->createItem();

        $saleResponse = $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '1000000',
                'payment_method' => 'credito',
                'credit_payment_method_id' => CreditPaymentMethod::query()->where('slug', 'addi')->value('id'),
                'credit_term_type' => '8_days',
                'payments' => [
                    ['method' => 'credito', 'amount' => 400000],
                ],
            ])
            ->assertCreated();

        $saleId = $saleResponse->json('id');

        $this->withToken($token)
            ->postJson("/api/sales/{$saleId}/payments", [
                'method' => 'efectivo',
                'amount' => 600000,
            ])
            ->assertOk()
            ->assertJsonPath('credit_status', 'paid');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $seller->id,
            'auditable_type' => Sale::class,
            'auditable_id' => $saleId,
            'action' => 'payment_added',
            'field' => 'amount_paid',
            'new_value' => '1000000.00',
        ]);
    }

    public function test_import_records_ingreso_per_item_and_system_audit(): void
    {
        [$user, $token] = $this->actingAsRole(User::ROLE_INVENTORY);

        $csv = "name,imei,sale_price,status\nIPHONE CSV 1,111111111111111,2000000,disponible\nIPHONE CSV 2,222222222222222,2500000,disponible\n";
        $file = UploadedFile::fake()->createWithContent('inventario.csv', $csv);

        $response = $this->withToken($token)
            ->post('/api/inventory/import', ['file' => $file]);

        $response->assertOk()
            ->assertJsonPath('created', 2);

        $items = InventoryItem::query()->whereIn('imei', ['111111111111111', '222222222222222'])->get();
        $this->assertCount(2, $items);

        foreach ($items as $item) {
            $this->assertDatabaseHas('inventory_movements', [
                'inventory_item_id' => $item->id,
                'user_id' => $user->id,
                'type' => 'ingreso',
                'notes' => 'Importación Excel/CSV',
            ]);
        }

        $audit = AuditLog::query()
            ->where('auditable_type', 'system')
            ->where('action', 'import')
            ->first();

        $this->assertNotNull($audit);
        $this->assertSame($user->id, $audit->user_id);
        $this->assertSame(2, $audit->meta['created'] ?? null);
        $this->assertSame(0, $audit->meta['skipped'] ?? null);
    }

    public function test_service_ticket_records_status_changes_and_ticket_audit(): void
    {
        [$tech, $techToken] = $this->actingAsRole(User::ROLE_INVENTORY);
        [$creator, $creatorToken] = $this->actingAsRole(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $ticketResponse = $this->withToken($creatorToken)
            ->postJson('/api/service-tickets', [
                'ticket_type' => 'inventario',
                'inventory_item_id' => $item->id,
                'assigned_user_id' => $tech->id,
                'issue_description' => 'Pantalla rota',
                'repair_notes' => 'Cambio de display',
            ]);

        $ticketResponse->assertCreated();
        $ticketId = $ticketResponse->json('id');

        $this->withToken($creatorToken)
            ->putJson("/api/service-tickets/{$ticketId}", [
                'status' => ServiceTicketStatus::SERVICIO_TECNICO,
            ])
            ->assertOk();

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'user_id' => $creator->id,
            'type' => 'status_change',
            'field' => 'status',
            'old_value' => InventoryStatus::DISPONIBLE,
            'new_value' => InventoryStatus::SERVICIO_TECNICO,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $creator->id,
            'auditable_type' => ServiceTicket::class,
            'auditable_id' => $ticketId,
            'action' => 'created',
        ]);

        $this->withToken($creatorToken)
            ->putJson("/api/service-tickets/{$ticketId}", [
                'status' => ServiceTicketStatus::SERVICIO_REALIZADO,
            ])
            ->assertOk();

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'user_id' => $creator->id,
            'type' => 'status_change',
            'field' => 'status',
            'old_value' => InventoryStatus::SERVICIO_TECNICO,
            'new_value' => InventoryStatus::DISPONIBLE,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $creator->id,
            'auditable_type' => ServiceTicket::class,
            'auditable_id' => $ticketId,
            'action' => 'updated',
            'field' => 'status',
            'new_value' => ServiceTicketStatus::SERVICIO_REALIZADO,
        ]);
    }

    public function test_show_item_returns_movements_with_user(): void
    {
        [$user, $token] = $this->actingAsRole(User::ROLE_INVENTORY);

        $create = $this->withToken($token)
            ->postJson('/api/inventory', [
                'name' => 'IPHONE HISTORIAL',
                'imei' => '555444333222111',
                'status' => InventoryStatus::DISPONIBLE,
            ])
            ->assertCreated();

        $itemId = $create->json('id');

        $this->withToken($token)
            ->putJson("/api/inventory/{$itemId}", ['notes' => 'Equipo revisado'])
            ->assertOk();

        $show = $this->withToken($token)
            ->getJson("/api/inventory/{$itemId}")
            ->assertOk();

        $movements = $show->json('movements');
        $this->assertIsArray($movements);
        $this->assertGreaterThanOrEqual(2, count($movements));

        foreach ($movements as $movement) {
            $this->assertArrayHasKey('type', $movement);
            $this->assertArrayHasKey('user', $movement);
            $this->assertSame($user->id, $movement['user']['id'] ?? null);
            $this->assertSame($user->name, $movement['user']['name'] ?? null);
        }

        $types = collect($movements)->pluck('type')->all();
        $this->assertContains('ingreso', $types);
        $this->assertContains('field_update', $types);
    }

    public function test_audit_logs_api_is_super_admin_only_and_returns_inventory_events(): void
    {
        [$admin, $adminToken] = $this->actingAsRole(User::ROLE_SUPER_ADMIN);
        [$inventoryUser, $inventoryToken] = $this->actingAsRole(User::ROLE_INVENTORY);

        $this->assertTrue($admin->fresh()->isSuperAdmin());

        $this->withToken($inventoryToken)
            ->postJson('/api/inventory', [
                'name' => 'AUDIT API TEST',
                'status' => InventoryStatus::DISPONIBLE,
            ])
            ->assertCreated();

        $this->withToken($inventoryToken)
            ->getJson('/api/audit-logs')
            ->assertForbidden();

        $response = $this->withToken($this->tokenForUser($admin, 'audit-read'))
            ->getJson('/api/audit-logs');
        $response->assertOk();
        $payload = $response->json();

        $this->assertArrayHasKey('data', $payload);
        $this->assertArrayHasKey('summary', $payload);
        $this->assertNotEmpty($payload['data']);

        $inventoryCreated = collect($payload['data'])->first(
            fn ($log) => ($log['auditable_type'] ?? '') === InventoryItem::class
                && ($log['action'] ?? '') === 'created'
        );

        $this->assertNotNull($inventoryCreated);
        $this->assertSame($inventoryUser->id, $inventoryCreated['user']['id'] ?? null);
        $this->assertNotEmpty($inventoryCreated['description'] ?? null);
        $this->assertSame('Creación', $inventoryCreated['action_label'] ?? null);
    }

    public function test_audit_logs_support_filters_and_enriched_fields(): void
    {
        [$admin, $adminToken] = $this->actingAsRole(User::ROLE_SUPER_ADMIN);
        [$inventoryUser, $inventoryToken] = $this->actingAsRole(User::ROLE_INVENTORY);

        $this->withToken($inventoryToken)
            ->postJson('/api/inventory', [
                'name' => 'IPHONE FILTRO AUDIT',
                'imei' => '777666555444333',
                'sale_price' => '1800000',
                'status' => InventoryStatus::DISPONIBLE,
            ])
            ->assertCreated();

        $response = $this->withToken($this->tokenForUser($admin, 'audit-filter'))
            ->getJson('/api/audit-logs?'.http_build_query([
                'user_id' => $inventoryUser->id,
                'entity' => 'inventory',
                'q' => 'IPHONE FILTRO',
            ]));

        $response->assertOk();
        $data = $response->json('data');
        $this->assertNotEmpty($data);
        $this->assertSame($inventoryUser->id, $data[0]['user']['id'] ?? null);
        $this->assertStringContainsString('IPHONE FILTRO AUDIT', $data[0]['entity_summary'] ?? '');
        $this->assertStringContainsString('Creación', $data[0]['description'] ?? '');
    }

    public function test_full_lifecycle_traceability_chain(): void
    {
        [$user, $token] = $this->actingAsRole(User::ROLE_INVENTORY);

        $itemId = $this->withToken($token)
            ->postJson('/api/inventory', [
                'name' => 'IPHONE LIFECYCLE',
                'imei' => '100200300400500',
                'sale_price' => '2000000',
                'status' => InventoryStatus::DISPONIBLE,
            ])
            ->assertCreated()
            ->json('id');

        $this->withToken($token)
            ->putJson("/api/inventory/{$itemId}", ['battery' => '92'])
            ->assertOk();

        $saleId = $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $itemId,
                'sale_price' => '2000000',
                'payment_method' => 'efectivo',
            ])
            ->assertCreated()
            ->json('id');

        $this->withToken($token)
            ->postJson("/api/inventory/{$itemId}/retake")
            ->assertOk();

        $this->withToken($token)
            ->postJson("/api/inventory/{$itemId}/retake")
            ->assertOk();

        $movements = InventoryMovement::query()
            ->where('inventory_item_id', $itemId)
            ->orderBy('created_at')
            ->pluck('type')
            ->all();

        $this->assertSame(
            ['ingreso', 'field_update', 'venta', 'retoma', 'reingreso'],
            $movements
        );

        $auditActions = AuditLog::query()
            ->where(function ($q) use ($itemId, $saleId) {
                $q->where(fn ($q2) => $q2->where('auditable_type', InventoryItem::class)->where('auditable_id', $itemId))
                    ->orWhere(fn ($q2) => $q2->where('auditable_type', Sale::class)->where('auditable_id', $saleId));
            })
            ->orderBy('created_at')
            ->pluck('action')
            ->all();

        $this->assertContains('created', $auditActions);
        $this->assertContains('updated', $auditActions);
        $this->assertContains('retake', $auditActions);
        $this->assertContains('reingreso', $auditActions);

        $saleAuditCount = AuditLog::query()
            ->where('auditable_type', Sale::class)
            ->where('auditable_id', $saleId)
            ->where('action', 'created')
            ->count();
        $this->assertSame(1, $saleAuditCount);

        $allMovementsHaveUser = InventoryMovement::query()
            ->where('inventory_item_id', $itemId)
            ->whereNull('user_id')
            ->count();
        $this->assertSame(0, $allMovementsHaveUser);
    }
}

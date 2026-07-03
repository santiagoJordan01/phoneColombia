<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Sale;
use App\Models\ServiceCategory;
use App\Models\ServiceCustomer;
use App\Models\ServiceTicket;
use App\Models\ServiceTicketState;
use App\Models\User;
use App\Support\InventoryStatus;
use App\Support\ServiceTicketStatus;
use App\Support\ServiceTicketType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Prueba integral de trazabilidad: movimientos por equipo + auditoría global + reglas de coherencia.
 */
class TraceabilityIntegrationTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: string} */
    private function actingAsRole(string $role): array
    {
        $user = User::factory()->create([
            'password' => Hash::make('password'),
            'role' => $role,
            'is_admin' => $role === User::ROLE_SUPER_ADMIN,
        ]);

        return [$user, $user->createToken('trace')->plainTextToken];
    }

    private function tokenForUser(User $user, string $name = 'trace'): string
    {
        $this->app['auth']->guard('sanctum')->forgetUser();

        return $user->createToken($name)->plainTextToken;
    }

    public function test_catalog_crud_writes_audit_logs(): void
    {
        [$user, $token] = $this->actingAsRole(User::ROLE_INVENTORY);

        $customerId = $this->withToken($token)
            ->postJson('/api/service/customers', ['name' => 'Cliente Trazabilidad', 'phone' => '3009998877'])
            ->assertCreated()
            ->json('id');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'auditable_type' => ServiceCustomer::class,
            'auditable_id' => $customerId,
            'action' => 'created',
            'field' => 'name',
            'new_value' => 'Cliente Trazabilidad',
        ]);

        $this->withToken($token)
            ->putJson("/api/service/customers/{$customerId}", ['notes' => 'VIP'])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => ServiceCustomer::class,
            'auditable_id' => $customerId,
            'action' => 'updated',
            'field' => 'notes',
            'new_value' => 'VIP',
        ]);

        $categoryId = $this->withToken($token)
            ->postJson('/api/service/categories', ['name' => 'Tapa', 'slug' => 'tapa_test'])
            ->assertCreated()
            ->json('id');

        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => ServiceCategory::class,
            'auditable_id' => $categoryId,
            'action' => 'created',
        ]);

        $stateId = $this->withToken($token)
            ->postJson('/api/service/states', [
                'name' => 'Estado prueba trazabilidad',
                'slug' => 'estado_prueba_traz',
                'marks_in_service' => false,
                'releases_inventory' => false,
            ])
            ->assertCreated()
            ->json('id');

        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => ServiceTicketState::class,
            'auditable_id' => $stateId,
            'action' => 'created',
        ]);
    }

    public function test_separado_sale_st_service_and_retake_full_traceability(): void
    {
        [$inventoryUser, $invToken] = $this->actingAsRole(User::ROLE_INVENTORY);
        [$seller, $sellerToken] = $this->actingAsRole(User::ROLE_SELLER);
        [$admin] = $this->actingAsRole(User::ROLE_SUPER_ADMIN);

        // 1. Ingreso
        $itemId = $this->withToken($invToken)
            ->postJson('/api/inventory', [
                'name' => 'IPHONE TRAZA COMPLETA',
                'imei' => '111222333444555',
                'sale_price' => '2500000',
            ])
            ->assertCreated()
            ->json('id');

        // 2. Apartado formal (separado)
        $this->withToken($sellerToken)
            ->postJson("/api/inventory/{$itemId}/reserve", [
                'sale_price' => '2500000',
                'deposit_amount' => 500000,
                'deposit_method' => 'efectivo',
                'customer_name' => 'Comprador Apartado',
            ])
            ->assertCreated();

        $reservationSaleId = Sale::query()->where('inventory_item_id', $itemId)->value('id');

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $itemId,
            'type' => 'status_change',
            'old_value' => InventoryStatus::DISPONIBLE,
            'new_value' => InventoryStatus::SEPARADO,
        ]);

        // 3. Completar apartado → venta
        $saleId = $this->withToken($sellerToken)
            ->postJson("/api/sales/{$reservationSaleId}/complete-reservation", [
                'payment_method' => 'efectivo',
                'payments' => [
                    ['method' => 'efectivo', 'amount' => 2000000],
                ],
            ])
            ->assertOk()
            ->json('id');

        $ventaMovement = InventoryMovement::query()
            ->where('inventory_item_id', $itemId)
            ->where('type', 'venta')
            ->first();

        $this->assertNotNull($ventaMovement);
        $this->assertSame($saleId, $ventaMovement->meta['sale_id'] ?? null);

        $sale = Sale::find($saleId);
        $this->assertSame($sale->user_id, $ventaMovement->user_id);

        // 4. Retoma con sale_id
        $this->withToken($invToken)
            ->postJson("/api/inventory/{$itemId}/retake", [
                'retake_price' => '1400000',
                'retake_payment_method' => 'efectivo',
            ])
            ->assertOk()
            ->assertJsonPath('status', InventoryStatus::RETOMADO);

        $retomaMovement = InventoryMovement::query()
            ->where('inventory_item_id', $itemId)
            ->where('type', 'retoma')
            ->first();

        $this->assertSame($saleId, $retomaMovement->meta['sale_id'] ?? null);
        $this->assertSame('1400000', $retomaMovement->meta['retake_price'] ?? null);

        // 5. Reingreso
        $this->withToken($invToken)
            ->postJson("/api/inventory/{$itemId}/retake")
            ->assertOk()
            ->assertJsonPath('status', InventoryStatus::DISPONIBLE);

        // 6. Ticket ST — revisión sin mover inventario
        $ticketId = $this->withToken($invToken)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::INVENTARIO,
                'inventory_item_id' => $itemId,
                'issue_description' => 'Revisión post-retoma',
            ])
            ->assertCreated()
            ->assertJsonPath('status', ServiceTicketStatus::PROCESO_REVISION)
            ->json('id');

        $this->assertDatabaseHas('inventory_items', [
            'id' => $itemId,
            'status' => InventoryStatus::DISPONIBLE,
        ]);

        // 7. Pasa a taller — movimiento con ticket_id
        $this->withToken($invToken)
            ->putJson("/api/service-tickets/{$ticketId}", [
                'status' => ServiceTicketStatus::SERVICIO_TECNICO,
            ])
            ->assertOk();

        $stInMovement = InventoryMovement::query()
            ->where('inventory_item_id', $itemId)
            ->where('type', 'status_change')
            ->where('new_value', InventoryStatus::SERVICIO_TECNICO)
            ->latest('created_at')
            ->first();

        $this->assertSame($ticketId, $stInMovement->meta['ticket_id'] ?? null);

        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => ServiceTicket::class,
            'auditable_id' => $ticketId,
            'action' => 'updated',
            'field' => 'status',
            'new_value' => ServiceTicketStatus::SERVICIO_TECNICO,
        ]);

        // 8. Entrega ST — libera inventario con ticket_id
        $this->withToken($invToken)
            ->putJson("/api/service-tickets/{$ticketId}", [
                'status' => ServiceTicketStatus::SERVICIO_REALIZADO,
            ])
            ->assertOk();

        $stOutMovement = InventoryMovement::query()
            ->where('inventory_item_id', $itemId)
            ->where('type', 'status_change')
            ->where('new_value', InventoryStatus::DISPONIBLE)
            ->latest('created_at')
            ->first();

        $this->assertSame($ticketId, $stOutMovement->meta['ticket_id'] ?? null);

        // 9. Timeline completo vía API show
        $show = $this->withToken($invToken)
            ->getJson("/api/inventory/{$itemId}")
            ->assertOk();

        $types = collect($show->json('movements'))->pluck('type')->all();

        $this->assertContains('ingreso', $types);
        $this->assertContains('status_change', $types);
        $this->assertContains('venta', $types);
        $this->assertContains('retoma', $types);
        $this->assertContains('reingreso', $types);

        foreach ($show->json('movements') as $movement) {
            $this->assertNotNull($movement['user']['id'] ?? null, 'Cada movimiento debe tener usuario');
        }

        // 10. Auditoría global accesible para super admin
        $audit = $this->withToken($this->tokenForUser($admin, 'audit-read'))
            ->getJson('/api/audit-logs?entity=inventory')
            ->assertOk();

        $this->assertNotEmpty($audit->json('data'));
        $this->assertArrayHasKey('summary', $audit->json());

        $inventoryAudits = collect($audit->json('data'))
            ->where('auditable_id', $itemId)
            ->pluck('action')
            ->all();

        $this->assertContains('created', $inventoryAudits);
        $this->assertContains('updated', $inventoryAudits);
        $this->assertContains('retake', $inventoryAudits);
        $this->assertContains('reingreso', $inventoryAudits);
    }

    public function test_guard_blocks_incoherent_operations(): void
    {
        [$user, $token] = $this->actingAsRole(User::ROLE_INVENTORY);

        $item = InventoryItem::create([
            'name' => 'GUARD TEST',
            'imei' => '999000111222333',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);

        // No vendido manual
        $this->withToken($token)
            ->putJson("/api/inventory/{$item->id}", ['status' => InventoryStatus::VENDIDO])
            ->assertStatus(422);

        // Ticket abierto bloquea venta y segundo ticket
        $ticketId = $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::INVENTARIO,
                'inventory_item_id' => $item->id,
                'issue_description' => 'Ticket único',
            ])
            ->assertCreated()
            ->json('id');

        $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '1000000',
                'payment_method' => 'efectivo',
            ])
            ->assertStatus(422);

        $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::INVENTARIO,
                'inventory_item_id' => $item->id,
                'issue_description' => 'Segundo ticket',
            ])
            ->assertStatus(422);

        // No archivar con ticket abierto
        $this->withToken($token)
            ->deleteJson("/api/inventory/{$item->id}")
            ->assertStatus(422);

        // Cerrar ticket para liberar
        $this->withToken($token)
            ->putJson("/api/service-tickets/{$ticketId}", [
                'status' => ServiceTicketStatus::SERVICIO_TECNICO,
            ])
            ->assertOk();

        $this->withToken($token)
            ->putJson("/api/service-tickets/{$ticketId}", [
                'status' => ServiceTicketStatus::SERVICIO_REALIZADO,
            ])
            ->assertOk();

        // Ahora sí puede archivarse
        $this->withToken($token)
            ->deleteJson("/api/inventory/{$item->id}")
            ->assertOk();

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'type' => 'archived',
        ]);

        $this->assertSoftDeleted('inventory_items', ['id' => $item->id]);
    }

    public function test_all_movements_have_user_and_no_orphan_gaps(): void
    {
        [, $token] = $this->actingAsRole(User::ROLE_INVENTORY);

        $itemId = $this->withToken($token)
            ->postJson('/api/inventory', [
                'name' => 'SIN HUÉRFANOS',
                'imei' => '555666777888999',
            ])
            ->assertCreated()
            ->json('id');

        $this->withToken($token)
            ->putJson("/api/inventory/{$itemId}", ['battery' => 88, 'notes' => 'OK'])
            ->assertOk();

        $movements = InventoryMovement::query()->where('inventory_item_id', $itemId)->get();

        $this->assertGreaterThanOrEqual(2, $movements->count());
        $this->assertTrue($movements->every(fn ($m) => $m->user_id !== null));

        $audits = AuditLog::query()
            ->where('auditable_type', InventoryItem::class)
            ->where('auditable_id', $itemId)
            ->get();

        $this->assertTrue($audits->contains('action', 'created'));
        $this->assertTrue($audits->contains('action', 'updated'));
    }
}

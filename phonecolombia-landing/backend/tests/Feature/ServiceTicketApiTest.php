<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\ServiceTicket;
use App\Models\User;
use App\Support\InventoryStatus;
use App\Support\ServiceTicketStatus;
use App\Support\ServiceTicketType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ServiceTicketApiTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(string $role): string
    {
        $user = User::factory()->create([
            'password' => Hash::make('password'),
            'role' => $role,
            'is_admin' => $role === User::ROLE_SUPER_ADMIN,
        ]);

        return $user->createToken('test')->plainTextToken;
    }

    private function createItem(array $overrides = []): InventoryItem
    {
        return InventoryItem::create(array_merge([
            'name' => 'IPHONE 13 128GB',
            'imei' => '352099001761481',
            'barcode' => '1272',
            'sale_price' => '3200000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ], $overrides));
    }

    public function test_external_customer_ticket_without_inventory(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $response = $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::CLIENTE_EXTERNO,
                'device_name' => '13 PRO MAX VERDE',
                'device_reference' => 'NO IMEI',
                'workshop' => 'BLACK PHONE',
                'service_category' => 'bateria',
                'issue_description' => 'CAMBIO DE BATERIA',
                'repair_cost' => 70000,
                'customer_price' => 80000,
                'customer_name' => 'Carlos',
            ]);

        $response->assertCreated()
            ->assertJsonPath('ticket_type', ServiceTicketType::CLIENTE_EXTERNO)
            ->assertJsonPath('status', ServiceTicketStatus::PROCESO_REVISION)
            ->assertJsonPath('workshop', 'BLACK PHONE')
            ->assertJsonPath('repair_cost', '70000.00')
            ->assertJsonPath('display_name', '13 PRO MAX VERDE');

        $this->assertDatabaseHas('service_tickets', [
            'device_name' => '13 PRO MAX VERDE',
            'inventory_item_id' => null,
        ]);
    }

    public function test_warranty_ticket_marks_is_warranty(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::GARANTIA,
                'device_name' => '13 PM NEGRO',
                'issue_description' => 'BATERIA GARANTIA',
                'workshop' => 'IMEI',
            ])
            ->assertCreated()
            ->assertJsonPath('is_warranty', true);
    }

    public function test_inventory_ticket_stays_available_during_revision(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::INVENTARIO,
                'inventory_item_id' => $item->id,
                'issue_description' => 'REVISION TAPA',
                'workshop' => 'ALTA GAMA',
            ])
            ->assertCreated()
            ->assertJsonPath('status', ServiceTicketStatus::PROCESO_REVISION);

        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->id,
            'status' => InventoryStatus::DISPONIBLE,
        ]);
    }

    public function test_inventory_ticket_marks_item_when_state_marks_in_service(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $ticketId = $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::INVENTARIO,
                'inventory_item_id' => $item->id,
                'issue_description' => 'CAMBIO PANTALLA',
            ])
            ->assertCreated()
            ->json('id');

        $this->withToken($token)
            ->putJson("/api/service-tickets/{$ticketId}", [
                'status' => ServiceTicketStatus::SERVICIO_TECNICO,
            ])
            ->assertOk();

        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->id,
            'status' => InventoryStatus::SERVICIO_TECNICO,
        ]);
    }

    public function test_cannot_open_second_ticket_for_same_item(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::INVENTARIO,
                'inventory_item_id' => $item->id,
                'issue_description' => 'PRIMER TICKET',
            ])
            ->assertCreated();

        $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => ServiceTicketType::INVENTARIO,
                'inventory_item_id' => $item->id,
                'issue_description' => 'SEGUNDO TICKET',
            ])
            ->assertStatus(422);
    }

    public function test_workshops_meta_endpoint(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->getJson('/api/service-tickets/workshops')
            ->assertOk()
            ->assertJsonStructure(['workshops', 'categories', 'ticket_types', 'statuses'])
            ->assertJsonFragment(['BLACK PHONE']);
    }

    public function test_filter_tickets_by_workshop(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        ServiceTicket::create([
            'ticket_type' => ServiceTicketType::CLIENTE_EXTERNO,
            'device_name' => '11 BLANCO',
            'issue_description' => 'BATERIA',
            'workshop' => 'BLACK PHONE',
            'status' => ServiceTicketStatus::PROCESO_REVISION,
            'received_at' => now(),
        ]);

        ServiceTicket::create([
            'ticket_type' => ServiceTicketType::CLIENTE_EXTERNO,
            'device_name' => '12 PRO',
            'issue_description' => 'PANTALLA',
            'workshop' => 'IMEI',
            'status' => ServiceTicketStatus::PROCESO_REVISION,
            'received_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson('/api/service-tickets?workshop=IMEI')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.workshop', 'IMEI');
    }
}

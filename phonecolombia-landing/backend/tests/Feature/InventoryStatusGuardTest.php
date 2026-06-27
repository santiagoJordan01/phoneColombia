<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\ServiceTicket;
use App\Models\User;
use App\Support\InventoryStatus;
use App\Support\ServiceTicketStatus;
use App\Support\ServiceTicketType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InventoryStatusGuardTest extends TestCase
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
            'sale_price' => '3200000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ], $overrides));
    }

    public function test_cannot_manually_set_vendido_without_sale(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $this->withToken($token)
            ->putJson("/api/inventory/{$item->id}", ['status' => InventoryStatus::VENDIDO])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_can_toggle_between_disponible_and_separado(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $this->withToken($token)
            ->putJson("/api/inventory/{$item->id}", ['status' => InventoryStatus::SEPARADO])
            ->assertOk()
            ->assertJsonPath('status', InventoryStatus::SEPARADO);

        $this->withToken($token)
            ->putJson("/api/inventory/{$item->id}", ['status' => InventoryStatus::DISPONIBLE])
            ->assertOk()
            ->assertJsonPath('status', InventoryStatus::DISPONIBLE);
    }

    public function test_can_sell_separado_item(): void
    {
        $token = $this->tokenFor(User::ROLE_SELLER);
        $item = $this->createItem(['status' => InventoryStatus::SEPARADO]);

        $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '3200000',
                'payment_method' => 'efectivo',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->id,
            'status' => InventoryStatus::VENDIDO,
        ]);
    }

    public function test_cannot_sell_item_with_open_service_ticket(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        ServiceTicket::create([
            'ticket_type' => ServiceTicketType::INVENTARIO,
            'inventory_item_id' => $item->id,
            'issue_description' => 'Pantalla',
            'status' => ServiceTicketStatus::PROCESO_REVISION,
            'received_at' => now(),
        ]);

        $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '3200000',
                'payment_method' => 'efectivo',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['inventory_item_id']);
    }

    public function test_retake_records_sale_id_in_movement_meta(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem(['status' => InventoryStatus::VENDIDO]);

        $sale = Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => User::factory()->create()->id,
            'sale_price' => '3000000',
            'payment_method' => 'efectivo',
            'credit_status' => 'paid',
            'amount_paid' => 3000000,
            'amount_due' => 0,
            'sold_at' => now(),
        ]);

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/retake")
            ->assertOk();

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'type' => 'retoma',
        ]);

        $movement = $item->movements()->where('type', 'retoma')->first();
        $this->assertSame($sale->id, $movement->meta['sale_id'] ?? null);
    }
}

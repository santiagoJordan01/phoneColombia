<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InventorySoldVisibilityTest extends TestCase
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

    public function test_default_inventory_list_excludes_sold_items(): void
    {
        InventoryItem::create([
            'name' => 'DISPONIBLE',
            'imei' => '352099001761601',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);
        InventoryItem::create([
            'name' => 'VENDIDO',
            'imei' => '352099001761602',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        $token = $this->tokenFor(User::ROLE_SELLER);

        $this->withToken($token)
            ->getJson('/api/inventory')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'DISPONIBLE');
    }

    public function test_inventory_admin_can_list_sold_items(): void
    {
        InventoryItem::create([
            'name' => 'VENDIDO ADMIN',
            'imei' => '352099001761603',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->getJson('/api/inventory?status=vendido')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'VENDIDO ADMIN');
    }

    public function test_seller_cannot_query_sold_status(): void
    {
        InventoryItem::create([
            'name' => 'VENDIDO',
            'imei' => '352099001761604',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        $token = $this->tokenFor(User::ROLE_SELLER);

        $this->withToken($token)
            ->getJson('/api/inventory?status=vendido')
            ->assertForbidden();
    }
}

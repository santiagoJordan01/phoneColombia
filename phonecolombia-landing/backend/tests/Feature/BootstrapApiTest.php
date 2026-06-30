<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BootstrapApiTest extends TestCase
{
    use RefreshDatabase;

    private function inventoryUser(): User
    {
        return User:: factory()->create([
            'password' => Hash::make('password'),
            'role' => User::ROLE_INVENTORY,
        ]);
    }

    public function test_inventory_bootstrap_returns_user_and_items(): void
    {
        Sanctum::actingAs($this->inventoryUser());

        $this->getJson('/api/bootstrap/inventory')
            ->assertOk()
            ->assertJsonStructure(['user' => ['id', 'email', 'role'], 'items']);
    }

    public function test_sales_bootstrap_returns_sales_and_available_items(): void
    {
        Sanctum::actingAs($this->inventoryUser());

        $this->getJson('/api/bootstrap/sales')
            ->assertOk()
            ->assertJsonStructure(['user', 'sales', 'available_items']);
    }

    public function test_service_tickets_bootstrap_returns_meta_and_tickets(): void
    {
        Sanctum::actingAs($this->inventoryUser());

        $this->getJson('/api/bootstrap/service-tickets')
            ->assertOk()
            ->assertJsonStructure(['user', 'meta', 'tickets']);
    }

    public function test_dashboard_bootstrap_returns_dashboard_payload(): void
    {
        Sanctum::actingAs($this->inventoryUser());

        $this->getJson('/api/bootstrap/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'user',
                'dashboard' => [
                    'inventory',
                    'sales',
                    'trends' => ['sales_count_7d', 'sales_revenue_7d', 'inventory_added_7d'],
                ],
            ]);
    }
}

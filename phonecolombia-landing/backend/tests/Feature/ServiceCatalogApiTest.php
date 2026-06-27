<?php

namespace Tests\Feature;

use App\Models\ServiceCategory;
use App\Models\ServiceCustomer;
use App\Models\ServiceTechnician;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ServiceCatalogApiTest extends TestCase
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

    public function test_can_manage_service_customers_categories_and_technicians(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $customer = $this->withToken($token)
            ->postJson('/api/service/customers', [
                'name' => 'Carlos Pérez',
                'phone' => '3001234567',
            ])
            ->assertCreated()
            ->json();

        $category = $this->withToken($token)
            ->postJson('/api/service/categories', [
                'name' => 'Micrófono',
                'slug' => 'microfono',
            ])
            ->assertCreated()
            ->json();

        $technician = $this->withToken($token)
            ->postJson('/api/service/technicians', [
                'name' => 'Técnico Castillo',
                'workshop' => 'CASTILLO',
                'phone' => '3100000000',
            ])
            ->assertCreated()
            ->json();

        $this->withToken($token)
            ->getJson('/api/service/customers?active_only=1')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Carlos Pérez']);

        $this->withToken($token)
            ->putJson("/api/service/customers/{$customer['id']}", ['notes' => 'Cliente frecuente'])
            ->assertOk()
            ->assertJsonPath('notes', 'Cliente frecuente');

        $this->assertDatabaseHas('service_categories', ['slug' => 'microfono']);
        $this->assertDatabaseHas('service_technicians', ['workshop' => 'CASTILLO']);

        $this->withToken($token)
            ->deleteJson("/api/service/technicians/{$technician['id']}")
            ->assertOk();

        $this->assertDatabaseMissing('service_technicians', ['id' => $technician['id']]);
    }

    public function test_ticket_can_link_catalog_entities(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $customerId = ServiceCustomer::create(['name' => 'Ana Gómez', 'phone' => '3001112233'])->id;
        $categoryId = ServiceCategory::create(['name' => 'Batería', 'slug' => 'bateria_test'])->id;
        $technicianId = ServiceTechnician::create(['name' => 'BLACK PHONE', 'workshop' => 'BLACK PHONE'])->id;

        $this->withToken($token)
            ->postJson('/api/service-tickets', [
                'ticket_type' => 'cliente_externo',
                'device_name' => '13 ROSADO',
                'service_customer_id' => $customerId,
                'service_category_id' => $categoryId,
                'service_technician_id' => $technicianId,
                'issue_description' => 'CAMBIO DE BATERIA',
                'repair_cost' => 70000,
            ])
            ->assertCreated()
            ->assertJsonPath('service_customer.name', 'Ana Gómez')
            ->assertJsonPath('category.name', 'Batería')
            ->assertJsonPath('workshop', 'BLACK PHONE');
    }
}

<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\ServiceCustomer;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CustomerManagementTest extends TestCase
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

    public function test_asesor_can_manage_customers(): void
    {
        $token = $this->tokenFor(User::ROLE_ASESOR);

        $created = $this->withToken($token)
            ->postJson('/api/service/customers', [
                'name' => 'Cliente Ventas',
                'phone' => '3005556677',
            ])
            ->assertCreated()
            ->json();

        $this->withToken($token)
            ->putJson("/api/service/customers/{$created['id']}", [
                'name' => 'Cliente Actualizado',
                'phone' => '3009998877',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Cliente Actualizado');

        $this->withToken($token)
            ->deleteJson("/api/service/customers/{$created['id']}")
            ->assertOk();

        $this->assertDatabaseMissing('service_customers', ['id' => $created['id']]);
    }

    public function test_sale_links_service_customer(): void
    {
        $token = $this->tokenFor(User::ROLE_ASESOR);

        $customer = ServiceCustomer::create([
            'name' => 'Comprador Test',
            'phone' => '3001112233',
        ]);

        $item = InventoryItem::create([
            'name' => 'IPHONE 14',
            'imei' => '333333333333333',
            'sale_price' => '3000000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);

        $response = $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '3000000',
                'payment_method' => 'efectivo',
                'service_customer_id' => $customer->id,
            ])
            ->assertCreated();

        $response
            ->assertJsonPath('customer_name', 'Comprador Test')
            ->assertJsonPath('customer_phone', '3001112233')
            ->assertJsonPath('service_customer_id', $customer->id);
    }

    public function test_sale_auto_creates_customer_from_contact(): void
    {
        $token = $this->tokenFor(User::ROLE_ASESOR);

        $item = InventoryItem::create([
            'name' => 'IPHONE 14',
            'imei' => '444444444444444',
            'sale_price' => '3000000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);

        $response = $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '3000000',
                'payment_method' => 'efectivo',
                'customer_name' => 'Cliente Nuevo',
                'customer_phone' => '3008887766',
            ])
            ->assertCreated();

        $customerId = $response->json('service_customer_id');
        $this->assertNotNull($customerId);
        $this->assertDatabaseHas('service_customers', [
            'id' => $customerId,
            'name' => 'Cliente Nuevo',
            'phone' => '3008887766',
        ]);
    }

    public function test_sale_links_existing_customer_by_phone(): void
    {
        $token = $this->tokenFor(User::ROLE_ASESOR);

        $customer = ServiceCustomer::create([
            'name' => 'Cliente Existente',
            'phone' => '3005551234',
        ]);

        $item = InventoryItem::create([
            'name' => 'IPHONE 15',
            'imei' => '555555555555555',
            'sale_price' => '3500000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);

        $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '3500000',
                'payment_method' => 'efectivo',
                'customer_name' => 'Otro Nombre',
                'customer_phone' => '300 555 1234',
            ])
            ->assertCreated()
            ->assertJsonPath('service_customer_id', $customer->id)
            ->assertJsonPath('customer_name', 'Cliente Existente');
    }

    public function test_reserve_auto_creates_customer(): void
    {
        $token = $this->tokenFor(User::ROLE_ASESOR);

        $item = InventoryItem::create([
            'name' => 'IPHONE 13',
            'imei' => '666666666666666',
            'sale_price' => '2500000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);

        $response = $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '2500000',
                'deposit_amount' => 500000,
                'deposit_method' => 'efectivo',
                'customer_name' => 'Apartado Cliente',
                'customer_phone' => '3004443322',
            ])
            ->assertCreated();

        $customerId = $response->json('reservation.service_customer_id');
        $this->assertNotNull($customerId);
        $this->assertDatabaseHas('service_customers', [
            'id' => $customerId,
            'name' => 'Apartado Cliente',
        ]);
    }

    public function test_supplier_cannot_manage_customers(): void
    {
        $token = $this->tokenFor(User::ROLE_SUPPLIER);

        $this->withToken($token)
            ->postJson('/api/service/customers', ['name' => 'Bloqueado'])
            ->assertForbidden();
    }
}

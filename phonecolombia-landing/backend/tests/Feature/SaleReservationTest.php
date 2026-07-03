<?php

namespace Tests\Feature;

use App\Models\CreditPaymentMethod;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\User;
use App\Support\InventoryStatus;
use App\Support\SaleReservationStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SaleReservationTest extends TestCase
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
            'name' => 'IPHONE 15 128GB',
            'imei' => '352099001761499',
            'sale_price' => '3200000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ], $overrides));
    }

    public function test_reserve_creates_active_sale_and_separado_item_with_deposit(): void
    {
        $this->seed(\Database\Seeders\CreditPaymentMethodSeeder::class);
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $response = $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '3200000',
                'deposit_amount' => 500000,
                'deposit_method' => 'efectivo',
                'customer_name' => 'Juan Pérez',
                'customer_phone' => '3001234567',
            ])
            ->assertCreated();

        $saleId = $response->json('reservation.id');

        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->id,
            'status' => InventoryStatus::SEPARADO,
        ]);

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'inventory_item_id' => $item->id,
            'reservation_status' => SaleReservationStatus::ACTIVE,
            'amount_paid' => '500000.00',
            'amount_due' => '2700000.00',
        ]);

        $this->assertDatabaseHas('sale_payments', [
            'sale_id' => $saleId,
            'method' => 'efectivo',
            'amount' => '500000.00',
        ]);
    }

    public function test_complete_reservation_closes_sale_and_marks_item_vendido(): void
    {
        $tokenInventory = $this->tokenFor(User::ROLE_INVENTORY);
        $tokenSeller = $this->tokenFor(User::ROLE_SELLER);
        $item = $this->createItem();

        $saleId = $this->withToken($tokenInventory)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '2000000',
                'deposit_amount' => 500000,
                'deposit_method' => 'transferencia',
                'customer_name' => 'María',
            ])
            ->assertCreated()
            ->json('reservation.id');

        $this->withToken($tokenSeller)
            ->postJson("/api/sales/{$saleId}/complete-reservation", [
                'payment_method' => 'efectivo',
            ])
            ->assertOk()
            ->assertJsonPath('reservation_status', null)
            ->assertJsonPath('credit_status', 'paid');

        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->id,
            'status' => InventoryStatus::VENDIDO,
        ]);

        $sale = Sale::find($saleId);
        $this->assertNotNull($sale->sold_at);
        $this->assertNull($sale->reservation_status);
        $this->assertEquals(2000000, (float) $sale->amount_paid);
    }

    public function test_cannot_create_duplicate_sale_when_active_reservation_exists(): void
    {
        $tokenInventory = $this->tokenFor(User::ROLE_INVENTORY);
        $tokenSeller = $this->tokenFor(User::ROLE_SELLER);
        $item = $this->createItem();

        $this->withToken($tokenInventory)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '1500000',
                'deposit_amount' => 200000,
                'deposit_method' => 'efectivo',
            ])
            ->assertCreated();

        $this->withToken($tokenSeller)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '1500000',
                'payment_method' => 'efectivo',
            ])
            ->assertStatus(422);
    }

    public function test_cancel_reservation_releases_item(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '1800000',
            ])
            ->assertCreated();

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/cancel-reservation")
            ->assertOk()
            ->assertJsonPath('status', InventoryStatus::DISPONIBLE);

        $this->assertDatabaseHas('sales', [
            'inventory_item_id' => $item->id,
            'reservation_status' => SaleReservationStatus::CANCELLED,
        ]);
    }

    private function creditMethodId(): string
    {
        $this->seed(\Database\Seeders\CreditPaymentMethodSeeder::class);

        return CreditPaymentMethod::query()->where('slug', 'addi')->value('id');
    }

    public function test_complete_reservation_partial_mixto_requires_credit_meta(): void
    {
        $tokenInventory = $this->tokenFor(User::ROLE_INVENTORY);
        $tokenSeller = $this->tokenFor(User::ROLE_SELLER);
        $item = $this->createItem();

        $saleId = $this->withToken($tokenInventory)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '2000000',
                'deposit_amount' => 500000,
                'deposit_method' => 'efectivo',
            ])
            ->assertCreated()
            ->json('reservation.id');

        $this->withToken($tokenSeller)
            ->postJson("/api/sales/{$saleId}/complete-reservation", [
                'payment_method' => 'mixto',
                'payments' => [
                    ['method' => 'efectivo', 'amount' => 500000],
                    ['method' => 'transferencia', 'amount' => 200000],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['credit_payment_method_id']);
    }

    public function test_complete_reservation_partial_mixto_succeeds_with_credit_meta(): void
    {
        $tokenInventory = $this->tokenFor(User::ROLE_INVENTORY);
        $tokenSeller = $this->tokenFor(User::ROLE_SELLER);
        $item = $this->createItem();

        $saleId = $this->withToken($tokenInventory)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '2000000',
                'deposit_amount' => 500000,
                'deposit_method' => 'efectivo',
            ])
            ->assertCreated()
            ->json('reservation.id');

        $this->withToken($tokenSeller)
            ->postJson("/api/sales/{$saleId}/complete-reservation", [
                'payment_method' => 'mixto',
                'payments' => [
                    ['method' => 'efectivo', 'amount' => 500000],
                    ['method' => 'transferencia', 'amount' => 200000],
                ],
                'credit_payment_method_id' => $this->creditMethodId(),
                'credit_term_type' => '15_days',
            ])
            ->assertOk()
            ->assertJsonPath('amount_paid', '1200000.00')
            ->assertJsonPath('amount_due', '800000.00')
            ->assertJsonPath('credit_status', 'pending')
            ->assertJsonPath('reservation_status', null);
    }
}

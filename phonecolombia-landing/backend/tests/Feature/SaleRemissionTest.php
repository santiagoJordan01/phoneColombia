<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SaleRemissionTest extends TestCase
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

    public function test_reserve_assigns_sequential_remission_number(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $year = now()->year;
        $itemA = $this->createItem(['imei' => '352099001761501']);
        $itemB = $this->createItem(['imei' => '352099001761502']);

        $first = $this->withToken($token)
            ->postJson("/api/inventory/{$itemA->id}/reserve", [
                'sale_price' => '2500000',
                'deposit_amount' => 300000,
                'deposit_method' => 'efectivo',
            ])
            ->assertCreated()
            ->json('reservation.remission_number');

        $second = $this->withToken($token)
            ->postJson("/api/inventory/{$itemB->id}/reserve", [
                'sale_price' => '1800000',
            ])
            ->assertCreated()
            ->json('reservation.remission_number');

        $this->assertSame(sprintf('R-%d-000001', $year), $first);
        $this->assertSame(sprintf('R-%d-000002', $year), $second);
    }

    public function test_direct_sale_assigns_remission_number(): void
    {
        $this->seed(\Database\Seeders\CreditPaymentMethodSeeder::class);
        $seller = User::factory()->create(['role' => User::ROLE_SELLER]);
        $token = $seller->createToken('test')->plainTextToken;
        $item = $this->createItem(['imei' => '352099001761503', 'status' => InventoryStatus::DISPONIBLE]);
        $year = now()->year;

        $response = $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '2200000',
                'payment_method' => 'efectivo',
            ])
            ->assertCreated();

        $this->assertSame(sprintf('R-%d-000001', $year), $response->json('remission_number'));
    }

    public function test_remission_pdf_export(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem(['imei' => '352099001761504']);

        $saleId = $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '2000000',
                'deposit_amount' => 500000,
                'deposit_method' => 'efectivo',
                'customer_name' => 'Cliente Prueba',
            ])
            ->assertCreated()
            ->json('reservation.id');

        $this->withToken($token)
            ->get("/api/sales/{$saleId}/remission/pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_remission_json_preview(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem(['imei' => '352099001761506']);

        $saleId = $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '2000000',
                'deposit_amount' => 500000,
                'deposit_method' => 'efectivo',
                'customer_name' => 'Cliente Vista Previa',
            ])
            ->assertCreated()
            ->json('reservation.id');

        $this->withToken($token)
            ->getJson("/api/sales/{$saleId}/remission")
            ->assertOk()
            ->assertJsonPath('customer', 'Cliente Vista Previa')
            ->assertJsonPath('status_label', 'Apartado')
            ->assertJsonStructure([
                'sale_id',
                'remission_number',
                'status_label',
                'customer',
                'item',
                'sale_price',
                'amount_paid',
                'amount_due',
                'payments',
            ]);
    }

    public function test_by_remission_report_groups_sales_with_payments(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem(['imei' => '352099001761505']);
        $date = now()->toDateString();

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '2400000',
                'deposit_amount' => 600000,
                'deposit_method' => 'efectivo',
                'customer_name' => 'Grupo Remisión',
            ])
            ->assertCreated();

        $this->withToken($token)
            ->getJson("/api/reports/by-remission?from={$date}&to={$date}")
            ->assertOk()
            ->assertJsonPath('totals.count', 1)
            ->assertJsonPath('remissions.0.status', 'apartado')
            ->assertJsonPath('remissions.0.payments.0.amount', 600000)
            ->assertJsonStructure([
                'remissions' => [[
                    'remission_number',
                    'sale_id',
                    'item',
                    'payments',
                    'amount_paid',
                    'amount_due',
                ]],
            ]);
    }
}

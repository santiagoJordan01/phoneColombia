<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReportAccountingTest extends TestCase
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
            'purchase_price' => '2000000',
            'sale_price' => '2800000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ], $overrides));
    }

    public function test_report_uses_frozen_cost_not_updated_inventory_price(): void
    {
        $item = InventoryItem::create([
            'name' => 'IPHONE 15',
            'imei' => '352099001761499',
            'purchase_price' => '2000000',
            'sale_price' => '2800000',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        $seller = User::factory()->create(['role' => User::ROLE_SELLER]);

        Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => $seller->id,
            'sale_price' => '2800000',
            'purchase_price_at_sale' => '2000000',
            'payment_method' => 'efectivo',
            'credit_status' => 'paid',
            'amount_paid' => 2800000,
            'amount_due' => 0,
            'sold_at' => now(),
        ]);

        $item->update(['purchase_price' => '2500000']);

        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $this->withToken($token)
            ->getJson("/api/reports/daily?date={$date}")
            ->assertOk()
            ->assertJsonPath('sales.0.purchase_price_num', 2000000)
            ->assertJsonPath('sales.0.net_profit', 800000)
            ->assertJsonPath('totals.cost', 2000000)
            ->assertJsonPath('totals.profit', 800000);
    }

    public function test_payment_method_breakdown_uses_sale_payments(): void
    {
        $item = InventoryItem::create([
            'name' => 'IPHONE 14',
            'imei' => '352099001761488',
            'purchase_price' => '1800000',
            'sale_price' => '2500000',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        $sale = Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => User::factory()->create(['role' => User::ROLE_SELLER])->id,
            'sale_price' => '2500000',
            'purchase_price_at_sale' => '1800000',
            'payment_method' => 'mixto',
            'credit_status' => 'paid',
            'amount_paid' => 2500000,
            'amount_due' => 0,
            'sold_at' => now(),
        ]);

        $sale->payments()->create([
            'user_id' => $sale->user_id,
            'method' => 'efectivo',
            'amount' => 1000000,
            'paid_at' => now(),
        ]);
        $sale->payments()->create([
            'user_id' => $sale->user_id,
            'method' => 'transferencia',
            'amount' => 1500000,
            'paid_at' => now(),
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $response = $this->withToken($token)
            ->getJson("/api/reports/daily?date={$date}")
            ->assertOk();

        $byMethod = $response->json('totals.by_method');
        $this->assertEquals(1000000, $byMethod['efectivo']);
        $this->assertEquals(1500000, $byMethod['transferencia']);
    }

    public function test_monthly_comparison_uses_revenue_not_collected(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $year = now()->year;
        $month = now()->month;

        $this->withToken($token)
            ->getJson("/api/reports/monthly?year={$year}&month={$month}")
            ->assertOk()
            ->assertJsonStructure([
                'comparison' => [
                    'previous_month_revenue',
                    'current_month_revenue',
                    'previous_month_profit',
                    'current_month_profit',
                    'change_percent',
                ],
            ]);
    }

    public function test_daily_by_method_excludes_payments_outside_period(): void
    {
        $item = InventoryItem::create([
            'name' => 'IPHONE 14',
            'imei' => '352099001761488',
            'purchase_price' => '1800000',
            'sale_price' => '2500000',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        $saleDay = now()->subDay()->startOfDay()->addHours(10);
        $paymentDay = now()->startOfDay()->addHours(11);

        $sale = Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => User::factory()->create(['role' => User::ROLE_SELLER])->id,
            'sale_price' => '2500000',
            'purchase_price_at_sale' => '1800000',
            'payment_method' => 'credito',
            'credit_status' => 'pending',
            'amount_paid' => 500000,
            'amount_due' => 2000000,
            'sold_at' => $saleDay,
        ]);

        $sale->payments()->create([
            'user_id' => $sale->user_id,
            'method' => 'efectivo',
            'amount' => 500000,
            'paid_at' => $paymentDay,
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $saleDate = $saleDay->toDateString();
        $paymentDate = $paymentDay->toDateString();

        $this->withToken($token)
            ->getJson("/api/reports/daily?date={$saleDate}")
            ->assertOk()
            ->assertJsonPath('totals.collected', 500000)
            ->assertJsonPath('totals.collected_in_period', 0)
            ->assertJsonPath('totals.by_method', []);

        $this->withToken($token)
            ->getJson("/api/reports/daily?date={$paymentDate}")
            ->assertOk()
            ->assertJsonPath('totals.collected_in_period', 0)
            ->assertJsonPath('totals.by_method', []);

        $this->withToken($token)
            ->getJson("/api/reports/daily?from={$saleDate}&to={$paymentDate}")
            ->assertOk()
            ->assertJsonPath('totals.collected_in_period', 500000)
            ->assertJsonPath('totals.by_method.efectivo', 500000);
    }

    public function test_cash_register_includes_reservation_deposit_and_splits_collections(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();
        $depositDay = now()->toDateString();

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '3200000',
                'deposit_amount' => 500000,
                'deposit_method' => 'efectivo',
            ])
            ->assertCreated();

        $this->withToken($token)
            ->getJson("/api/reports/cash-register?from={$depositDay}&to={$depositDay}")
            ->assertOk()
            ->assertJsonPath('sales_count', 0)
            ->assertJsonPath('cash_collected_in_period', 500000)
            ->assertJsonPath('collections_on_period_sales', 0)
            ->assertJsonPath('collections_on_other_sales', 500000)
            ->assertJsonPath('by_payment_method.efectivo', 500000)
            ->assertJsonPath('by_collection_type.apartado', 500000)
            ->assertJsonCount(1, 'ledger')
            ->assertJsonPath('ledger.0.type', 'apartado')
            ->assertJsonPath('ledger.0.amount', 500000);
    }

    public function test_receivables_lists_active_apartado_and_credit(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $itemRes = $this->createItem(['imei' => '352099001761400']);
        $itemCred = $this->createItem(['imei' => '352099001761401', 'status' => InventoryStatus::VENDIDO]);

        $this->withToken($token)
            ->postJson("/api/inventory/{$itemRes->id}/reserve", [
                'sale_price' => '2500000',
                'deposit_amount' => 400000,
                'deposit_method' => 'efectivo',
                'customer_name' => 'Ana López',
            ])
            ->assertCreated();

        Sale::create([
            'inventory_item_id' => $itemCred->id,
            'user_id' => User::factory()->create(['role' => User::ROLE_SELLER])->id,
            'sale_price' => '1800000',
            'payment_method' => 'credito',
            'credit_status' => 'pending',
            'amount_paid' => 300000,
            'amount_due' => 1500000,
            'credit_due_at' => now()->subDay(),
            'customer_name' => 'Carlos Ruiz',
            'sold_at' => now()->subDays(3),
        ]);

        $this->withToken($token)
            ->getJson('/api/reports/receivables')
            ->assertOk()
            ->assertJsonPath('totals.count', 2)
            ->assertJsonPath('totals.apartados_count', 1)
            ->assertJsonPath('totals.creditos_count', 1)
            ->assertJsonPath('totals.overdue_count', 1)
            ->assertJsonPath('totals.apartados_due', 2100000)
            ->assertJsonPath('totals.creditos_due', 1500000);
    }

    public function test_dashboard_collected_today_uses_payment_date_not_sale_date(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/reserve", [
                'sale_price' => '2000000',
                'deposit_amount' => 300000,
                'deposit_method' => 'transferencia',
            ])
            ->assertCreated();

        $this->withToken($token)
            ->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('sales.today_count', 0)
            ->assertJsonPath('sales.collected_today', 300000)
            ->assertJsonPath('sales.revenue_today', 300000);
    }

    public function test_add_payment_rejects_amount_over_balance(): void
    {
        $item = InventoryItem::create([
            'name' => 'IPHONE 13',
            'imei' => '352099001761477',
            'purchase_price' => '1500000',
            'sale_price' => '2000000',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        $seller = User::factory()->create(['role' => User::ROLE_SELLER]);
        $token = $seller->createToken('test')->plainTextToken;

        $sale = Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => $seller->id,
            'sale_price' => '2000000',
            'purchase_price_at_sale' => '1500000',
            'payment_method' => 'credito',
            'credit_status' => 'pending',
            'amount_paid' => 500000,
            'amount_due' => 1500000,
            'sold_at' => now(),
        ]);

        $this->withToken($token)
            ->postJson("/api/sales/{$sale->id}/payments", [
                'method' => 'efectivo',
                'amount' => 1600000,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'El abono no puede superar el saldo pendiente.');
    }
}

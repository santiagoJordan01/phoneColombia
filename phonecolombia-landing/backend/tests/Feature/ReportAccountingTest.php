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
}

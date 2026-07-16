<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CashMovementTest extends TestCase
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

    public function test_seller_can_register_manual_cash_movement_and_see_it_in_settlement(): void
    {
        $token = $this->tokenFor(User::ROLE_SELLER);

        $this->withToken($token)
            ->postJson('/api/cash-movements', [
                'type' => 'ingreso',
                'method' => 'efectivo',
                'amount' => 50000,
                'concept' => 'Ajuste de caja',
                'occurred_at' => '2026-07-15',
            ])
            ->assertCreated()
            ->assertJsonPath('origen', 'manual')
            ->assertJsonPath('type', 'ingreso')
            ->assertJsonPath('amount', 50000);

        $this->assertDatabaseCount('cash_movements', 1);

        $inventoryToken = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($inventoryToken)
            ->getJson('/api/reports/daily-settlement?from=2026-07-15&to=2026-07-15')
            ->assertOk()
            ->assertJsonPath('ingresos_manuales', 50000)
            ->assertJsonPath('total_ingresos', 50000)
            ->assertJsonPath('neto_caja', 50000)
            ->assertJsonFragment([
                'origen' => 'manual',
                'origen_label' => 'Manual',
                'type' => 'ingreso',
                'concept' => 'Ajuste de caja',
            ]);
    }

    public function test_settlement_uses_payment_date_for_cash_income_not_sale_amount_paid(): void
    {
        $seller = User::factory()->create(['role' => User::ROLE_SELLER]);
        $item = InventoryItem::create([
            'name' => 'IPHONE 12',
            'imei' => '352099001761499',
            'sale_price' => '1000000',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        $sale = Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => $seller->id,
            'sale_price' => '1000000',
            'payment_method' => 'efectivo',
            'credit_status' => 'paid',
            'amount_paid' => 1000000,
            'amount_due' => 0,
            'sold_at' => Carbon::parse('2026-07-15 10:00:00', 'America/Bogota')->timezone('UTC'),
            'remission_number' => 'R-2026-000200',
        ]);

        // Cobro registrado el mismo día → sí entra a caja del 15.
        SalePayment::create([
            'sale_id' => $sale->id,
            'user_id' => $seller->id,
            'method' => 'efectivo',
            'amount' => 1000000,
            'paid_at' => Carbon::parse('2026-07-15 10:05:00', 'America/Bogota')->timezone('UTC'),
        ]);

        CashMovement::create([
            'user_id' => $seller->id,
            'type' => CashMovement::TYPE_EGRESO,
            'method' => 'efectivo',
            'amount' => 20000,
            'concept' => 'Domicilio',
            'occurred_at' => Carbon::parse('2026-07-15 12:00:00', 'America/Bogota')->timezone('UTC'),
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->getJson('/api/reports/daily-settlement?from=2026-07-15&to=2026-07-15')
            ->assertOk()
            ->assertJsonPath('ventas_netas', 1000000)
            ->assertJsonPath('ingresos_cobros', 1000000)
            ->assertJsonPath('egresos_manuales', 20000)
            ->assertJsonPath('total_ingresos', 1000000)
            ->assertJsonPath('total_egresos', 20000)
            ->assertJsonPath('neto_caja', 980000)
            ->assertJsonPath('diferencia', 0)
            ->assertJsonPath('cobrado_acumulado_ventas', 1000000)
            ->assertJsonPath('pendiente_ventas', 0)
            ->assertJsonFragment(['origen_label' => 'Cobro venta'])
            ->assertJsonFragment(['origen' => 'manual', 'type' => 'egreso', 'concept' => 'Domicilio']);
    }

    public function test_settlement_excludes_sale_without_payment_from_cash_income(): void
    {
        $item = InventoryItem::create([
            'name' => 'IPHONE SE',
            'imei' => '352099001761500',
            'sale_price' => '800000',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => User::factory()->create(['role' => User::ROLE_SELLER])->id,
            'sale_price' => '800000',
            'payment_method' => 'credito',
            'credit_status' => 'pending',
            'amount_paid' => 0,
            'amount_due' => 800000,
            'sold_at' => Carbon::parse('2026-07-15 11:00:00', 'America/Bogota')->timezone('UTC'),
            'remission_number' => 'R-2026-000201',
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->getJson('/api/reports/daily-settlement?from=2026-07-15&to=2026-07-15')
            ->assertOk()
            ->assertJsonPath('ventas_netas', 800000)
            ->assertJsonPath('total_ingresos', 0)
            ->assertJsonPath('credito_del_dia', 800000)
            ->assertJsonPath('pendiente_ventas', 800000)
            ->assertJsonPath('cobrado_acumulado_ventas', 0)
            ->assertJsonPath('diferencia', 0)
            ->assertJsonPath('equipos_count', 1);
    }

    public function test_settlement_difference_uses_accumulated_paid_not_only_today_collections(): void
    {
        $seller = User::factory()->create(['role' => User::ROLE_SELLER]);
        $item = InventoryItem::create([
            'name' => 'IPHONE 11',
            'imei' => '352099001761501',
            'sale_price' => '1200000',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        $sale = Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => $seller->id,
            'sale_price' => '1200000',
            'payment_method' => 'efectivo',
            'credit_status' => 'paid',
            'amount_paid' => 1200000,
            'amount_due' => 0,
            'sold_at' => Carbon::parse('2026-07-15 16:00:00', 'America/Bogota')->timezone('UTC'),
            'remission_number' => 'R-2026-000202',
        ]);

        // Abono previo (día anterior) + cobro de cierre hoy.
        SalePayment::create([
            'sale_id' => $sale->id,
            'user_id' => $seller->id,
            'method' => 'efectivo',
            'amount' => 400000,
            'paid_at' => Carbon::parse('2026-07-14 10:00:00', 'America/Bogota')->timezone('UTC'),
        ]);
        SalePayment::create([
            'sale_id' => $sale->id,
            'user_id' => $seller->id,
            'method' => 'efectivo',
            'amount' => 800000,
            'paid_at' => Carbon::parse('2026-07-15 16:05:00', 'America/Bogota')->timezone('UTC'),
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->getJson('/api/reports/daily-settlement?from=2026-07-15&to=2026-07-15')
            ->assertOk()
            ->assertJsonPath('ventas_netas', 1200000)
            ->assertJsonPath('cobrado_ventas_del_dia', 800000)
            ->assertJsonPath('cobrado_acumulado_ventas', 1200000)
            ->assertJsonPath('pendiente_ventas', 0)
            ->assertJsonPath('diferencia', 0)
            ->assertJsonPath('ingresos_cobros', 800000);
    }
}

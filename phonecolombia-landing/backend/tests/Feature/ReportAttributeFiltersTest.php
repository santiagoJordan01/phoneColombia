<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\InventoryProduct;
use App\Models\Sale;
use App\Models\User;
use App\Support\InventoryStatus;
use App\Support\ReportPeriod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReportAttributeFiltersTest extends TestCase
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

    private function reportDate(): string
    {
        return now(ReportPeriod::TIMEZONE)->toDateString();
    }

    private function createSoldItem(array $itemOverrides = [], array $productOverrides = []): Sale
    {
        $product = InventoryProduct::create(array_merge([
            'name' => 'IPHONE 15 128GB',
            'brand' => 'IPHONE',
            'model' => '15',
            'storage' => '128GB',
            'category' => 'celular',
        ], $productOverrides));

        $item = InventoryItem::create(array_merge([
            'inventory_product_id' => $product->id,
            'name' => $product->name,
            'imei' => (string) random_int(100000000000000, 999999999999999),
            'purchase_price' => '2000000',
            'sale_price' => '2800000',
            'storage' => $product->storage,
            'color' => 'NEGRO',
            'battery' => 90,
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ], $itemOverrides));

        return Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => User::factory()->create(['role' => User::ROLE_SELLER])->id,
            'sale_price' => '2800000',
            'purchase_price_at_sale' => '2000000',
            'payment_method' => 'efectivo',
            'credit_status' => 'paid',
            'amount_paid' => 2800000,
            'amount_due' => 0,
            'sold_at' => now(ReportPeriod::TIMEZONE),
        ]);
    }

    public function test_daily_report_filters_by_storage_color_and_battery(): void
    {
        $match = $this->createSoldItem([
            'color' => 'NEGRO',
            'battery' => 92,
            'storage' => '128GB',
        ], [
            'name' => 'IPHONE 15 128GB',
            'model' => '15',
            'storage' => '128GB',
        ]);

        $this->createSoldItem([
            'color' => 'AZUL',
            'battery' => 70,
            'storage' => '256GB',
            'imei' => (string) random_int(100000000000000, 999999999999999),
        ], [
            'name' => 'IPHONE 15 256GB',
            'model' => '15',
            'storage' => '256GB',
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = $this->reportDate();

        $byStorage = $this->withToken($token)
            ->getJson("/api/reports/daily?date={$date}&storage=128GB")
            ->assertOk()
            ->json('sales');

        $this->assertCount(1, $byStorage);
        $this->assertSame($match->id, $byStorage[0]['id']);

        $byColor = $this->withToken($token)
            ->getJson("/api/reports/daily?date={$date}&color=NEGRO")
            ->assertOk()
            ->json('sales');

        $this->assertCount(1, $byColor);
        $this->assertSame($match->id, $byColor[0]['id']);

        $byBatteryOk = $this->withToken($token)
            ->getJson("/api/reports/daily?date={$date}&battery_status=ok")
            ->assertOk()
            ->json('sales');

        $this->assertCount(1, $byBatteryOk);
        $this->assertSame($match->id, $byBatteryOk[0]['id']);

        $byBatteryExact = $this->withToken($token)
            ->getJson("/api/reports/daily?date={$date}&battery=92")
            ->assertOk()
            ->json('sales');

        $this->assertCount(1, $byBatteryExact);
        $this->assertSame($match->id, $byBatteryExact[0]['id']);

        $byBrandModel = $this->withToken($token)
            ->getJson("/api/reports/daily?date={$date}&brand=IPHONE&model=15&storage=128GB")
            ->assertOk()
            ->json('sales');

        $this->assertCount(1, $byBrandModel);
        $this->assertSame($match->id, $byBrandModel[0]['id']);
    }

    public function test_inventory_intake_filters_by_brand_and_battery_baja(): void
    {
        $productOk = InventoryProduct::create([
            'name' => 'SAMSUNG A54 128GB',
            'brand' => 'SAMSUNG',
            'model' => 'A54',
            'storage' => '128GB',
            'category' => 'celular',
        ]);
        $productBaja = InventoryProduct::create([
            'name' => 'IPHONE 13 128GB',
            'brand' => 'IPHONE',
            'model' => '13',
            'storage' => '128GB',
            'category' => 'celular',
        ]);

        InventoryItem::create([
            'inventory_product_id' => $productOk->id,
            'name' => $productOk->name,
            'imei' => '352099001761411',
            'purchase_price' => '1000000',
            'sale_price' => '1400000',
            'storage' => '128GB',
            'color' => 'NEGRO',
            'battery' => 95,
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
            'acquired_at' => now(ReportPeriod::TIMEZONE),
        ]);

        $baja = InventoryItem::create([
            'inventory_product_id' => $productBaja->id,
            'name' => $productBaja->name,
            'imei' => '352099001761422',
            'purchase_price' => '1500000',
            'sale_price' => '2000000',
            'storage' => '128GB',
            'color' => 'BLANCO',
            'battery' => 80,
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
            'acquired_at' => now(ReportPeriod::TIMEZONE),
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = $this->reportDate();

        $response = $this->withToken($token)
            ->getJson("/api/reports/inventory-intake?from={$date}&to={$date}&brand=IPHONE&battery_status=baja")
            ->assertOk();

        $items = collect($response->json('items') ?? [])->values();
        $this->assertCount(1, $items);
        $this->assertSame($baja->id, $items[0]['id']);
    }
}

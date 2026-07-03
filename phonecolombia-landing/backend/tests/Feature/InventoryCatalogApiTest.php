<?php

namespace Tests\Feature;

use App\Models\DeviceBrand;
use App\Models\DeviceColor;
use App\Models\InventoryItem;
use App\Models\InventoryProduct;
use App\Models\Supplier;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InventoryCatalogApiTest extends TestCase
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

    public function test_can_update_supplier_and_cascade_name_to_items(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $supplier = Supplier::create([
            'name' => 'RETOMA',
            'phone' => '3001112233',
        ]);

        $item = InventoryItem::create([
            'name' => 'IPHONE 13',
            'imei' => '111111111111111',
            'supplier' => 'RETOMA',
            'supplier_id' => $supplier->id,
            'sale_price' => '2000000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);

        $this->withToken($token)
            ->putJson("/api/suppliers/{$supplier->id}", [
                'name' => 'RETOMA BOGOTA',
                'phone' => '3009998877',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'RETOMA BOGOTA')
            ->assertJsonPath('phone', '3009998877');

        $item->refresh();
        $this->assertSame('RETOMA BOGOTA', $item->supplier);
        $this->assertSame($supplier->id, $item->supplier_id);
    }

    public function test_can_update_color_and_cascade_to_items(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $color = DeviceColor::query()->where('name', 'NEGRO')->firstOrFail();

        $item = InventoryItem::create([
            'name' => 'IPHONE 13 128GB NEGRO',
            'imei' => '222222222222222',
            'color' => 'NEGRO',
            'sale_price' => '2500000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);

        $this->withToken($token)
            ->putJson("/api/device-colors/{$color->id}", ['name' => 'CARBON'])
            ->assertOk()
            ->assertJsonPath('name', 'CARBON');

        $item->refresh();

        $this->assertSame('CARBON', $item->color);
    }

    public function test_catalog_product_ignores_color_and_item_name_includes_unit_color(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $product = InventoryProduct::create([
            'name' => 'IPHONE 13 128GB',
            'brand' => 'IPHONE',
            'model' => '13',
            'storage' => '128GB',
            'category' => 'celular',
        ]);

        $this->withToken($token)
            ->postJson('/api/inventory/products', [
                'brand' => 'IPHONE',
                'model' => '14 PRO',
                'storage' => '256GB',
                'color' => 'NEGRO',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'IPHONE 14 PRO 256GB')
            ->assertJsonPath('color', null);

        $this->withToken($token)
            ->postJson('/api/inventory', [
                'inventory_product_id' => $product->id,
                'name' => 'placeholder',
                'imei' => '333333333333333',
                'color' => 'AZUL',
                'sale_price' => '2800000',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'IPHONE 13 128GB AZUL')
            ->assertJsonPath('color', 'AZUL');
    }

    public function test_creating_item_auto_registers_catalog_model(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->postJson('/api/inventory', [
                'catalog_brand' => 'IPHONE',
                'catalog_model' => '14 PRO',
                'catalog_storage' => '128GB',
                'imei' => '444444444444444',
                'color' => 'NEGRO',
                'sale_price' => '2800000',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'IPHONE 14 PRO 128GB NEGRO')
            ->assertJsonPath('color', 'NEGRO');

        $this->assertDatabaseHas('inventory_products', [
            'brand' => 'IPHONE',
            'model' => '14 PRO',
            'storage' => '128GB',
            'name' => 'IPHONE 14 PRO 128GB',
        ]);
    }

    public function test_seller_cannot_update_catalog_entries(): void
    {
        $token = $this->tokenFor(User::ROLE_SELLER);
        $supplier = Supplier::create(['name' => 'PROV']);
        $color = DeviceColor::query()->where('name', 'AZUL')->firstOrFail();

        $this->withToken($token)
            ->putJson("/api/suppliers/{$supplier->id}", ['name' => 'OTRO'])
            ->assertForbidden();

        $this->withToken($token)
            ->putJson("/api/device-colors/{$color->id}", ['name' => 'ROJO'])
            ->assertForbidden();

        $brand = DeviceBrand::query()->where('name', 'SAMSUNG')->firstOrFail();

        $this->withToken($token)
            ->putJson("/api/device-brands/{$brand->id}", ['name' => 'OTRA'])
            ->assertForbidden();
    }
}

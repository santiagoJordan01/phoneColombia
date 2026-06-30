<?php

namespace Tests\Feature;

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

    public function test_can_update_color_and_cascade_to_items_and_products(): void
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

        $product = InventoryProduct::create([
            'name' => 'IPHONE 13 128GB NEGRO',
            'brand' => 'IPHONE',
            'model' => '13',
            'storage' => '128GB',
            'color' => 'NEGRO',
            'category' => 'celular',
        ]);

        $this->withToken($token)
            ->putJson("/api/device-colors/{$color->id}", ['name' => 'CARBON'])
            ->assertOk()
            ->assertJsonPath('name', 'CARBON');

        $item->refresh();
        $product->refresh();

        $this->assertSame('CARBON', $item->color);
        $this->assertSame('CARBON', $product->color);
        $this->assertSame('IPHONE 13 128GB CARBON', $product->name);
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
    }
}

<?php

namespace Tests\Feature;

use App\Models\DeviceBrand;
use App\Models\InventoryProduct;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DeviceBrandApiTest extends TestCase
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

    public function test_can_list_and_create_brands(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->getJson('/api/device-brands')
            ->assertOk()
            ->assertJsonFragment(['name' => 'IPHONE']);

        $this->withToken($token)
            ->postJson('/api/device-brands', ['name' => 'ZTE'])
            ->assertCreated()
            ->assertJsonPath('name', 'ZTE');
    }

    public function test_renaming_brand_updates_catalog_products(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $brand = DeviceBrand::query()->where('name', 'IPHONE')->firstOrFail();

        InventoryProduct::create([
            'name' => 'IPHONE 13 128GB',
            'brand' => 'IPHONE',
            'model' => '13',
            'storage' => '128GB',
            'category' => 'celular',
        ]);

        $this->withToken($token)
            ->putJson("/api/device-brands/{$brand->id}", ['name' => 'APPLE IPHONE'])
            ->assertOk()
            ->assertJsonPath('name', 'APPLE IPHONE');

        $this->assertDatabaseHas('inventory_products', [
            'brand' => 'APPLE IPHONE',
            'name' => 'APPLE IPHONE 13 128GB',
        ]);
    }
}

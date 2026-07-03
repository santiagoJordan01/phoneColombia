<?php

namespace Tests\Feature;

use App\Models\InventoryProduct;
use App\Support\IphoneModelCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IphoneModelCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_contains_all_defined_iphone_models(): void
    {
        IphoneModelCatalog::seedMissing();

        $this->assertSame(
            count(IphoneModelCatalog::models()),
            InventoryProduct::query()->where('brand', IphoneModelCatalog::BRAND)->count(),
        );
        $this->assertDatabaseHas('inventory_products', [
            'name' => 'IPHONE 16 PRO MAX',
            'model' => '16 PRO MAX',
            'category' => 'celular',
        ]);
        $this->assertDatabaseHas('inventory_products', [
            'name' => 'IPHONE SE 2022',
            'model' => 'SE 2022',
        ]);
    }

    public function test_seed_missing_is_idempotent(): void
    {
        IphoneModelCatalog::seedMissing();

        $this->assertSame(0, IphoneModelCatalog::seedMissing());
    }

    public function test_seed_missing_creates_only_missing_models(): void
    {
        InventoryProduct::query()->where('brand', IphoneModelCatalog::BRAND)->delete();

        $created = IphoneModelCatalog::seedMissing();

        $this->assertSame(count(IphoneModelCatalog::models()), $created);
        $this->assertSame(0, IphoneModelCatalog::seedMissing());
    }
}

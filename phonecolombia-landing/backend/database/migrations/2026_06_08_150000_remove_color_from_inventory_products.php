<?php

use App\Models\InventoryProduct;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        InventoryProduct::query()->each(function (InventoryProduct $product) {
            $parts = array_filter([$product->brand, $product->model, $product->storage]);
            $name = strtoupper(trim(implode(' ', $parts)));
            if ($name === '') {
                $name = strtoupper(trim($product->name));
            }

            $product->update([
                'name' => $name,
                'color' => null,
            ]);
        });
    }

    public function down(): void
    {
        // No se restaura color en catálogo: es dato de cada equipo.
    }
};

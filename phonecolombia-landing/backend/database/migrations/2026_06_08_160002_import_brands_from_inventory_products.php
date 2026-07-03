<?php

use App\Models\InventoryProduct;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $existing = DB::table('device_brands')->pluck('name')->map(fn ($n) => strtoupper($n))->all();

        InventoryProduct::query()
            ->whereNotNull('brand')
            ->where('brand', '!=', '')
            ->distinct()
            ->pluck('brand')
            ->map(fn ($brand) => strtoupper(trim($brand)))
            ->filter()
            ->unique()
            ->each(function (string $brand) use ($existing) {
                if (in_array($brand, $existing, true)) {
                    return;
                }

                DB::table('device_brands')->insert([
                    'id' => (string) Str::uuid(),
                    'name' => $brand,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        // No se revierte: marcas importadas pueden seguir en uso.
    }
};

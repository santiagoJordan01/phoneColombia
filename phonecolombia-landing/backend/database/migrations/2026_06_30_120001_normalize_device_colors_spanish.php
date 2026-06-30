<?php

use App\Models\DeviceColor;
use App\Models\InventoryProduct;
use Database\Seeders\DeviceColorSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @var array<string, string> */
    private const RENAME_MAP = [
        '(PRODUCT)RED' => 'ROJO (PRODUCT)',
        'ALPINE GREEN' => 'VERDE ALPINO',
        'BLACK TITANIUM' => 'TITANIO NEGRO',
        'BLUE' => 'AZUL',
        'BLUE TITANIUM' => 'TITANIO AZUL',
        'CLOUD WHITE' => 'BLANCO NUBE',
        'COSMIC ORANGE' => 'NARANJA CÓSMICO',
        'DEEP BLUE' => 'AZUL PROFUNDO',
        'DEEP PURPLE' => 'MORADO PROFUNDO',
        'DESERT ROSE' => 'ROSA DESIERTO',
        'DESERT TITANIUM' => 'TITANIO DESIERTO',
        'GOLD' => 'DORADO',
        'GOLD TITANIUM' => 'TITANIO DORADO',
        'GRAPHITE' => 'GRAFITO',
        'GREEN' => 'VERDE',
        'JET BLACK' => 'NEGRO BRILLANTE',
        'LAVENDER' => 'LAVANDA',
        'LIGHT GOLD' => 'DORADO CLARO',
        'MATTE BLACK' => 'NEGRO MATE',
        'MIDNIGHT' => 'MEDIANOCHE',
        'MIDNIGHT GREEN' => 'VERDE MEDIANOCHE',
        'MINT' => 'MENTA',
        'MIST BLUE' => 'AZUL NIEBLA',
        'NATURAL TITANIUM' => 'TITANIO NATURAL',
        'PACIFIC BLUE' => 'AZUL PACÍFICO',
        'PINK' => 'ROSADO',
        'PURPLE' => 'MORADO',
        'RED' => 'ROJO',
        'ROSE GOLD' => 'ORO ROSA',
        'SAGE' => 'SALVIA',
        'SIERRA BLUE' => 'AZUL SIERRA',
        'SILVER' => 'PLATA',
        'SKY BLUE' => 'AZUL CIELO',
        'SLATE' => 'PIZARRA',
        'SLATE TITANIUM' => 'TITANIO PIZARRA',
        'SPACE BLACK' => 'NEGRO ESPACIAL',
        'SPACE GRAY' => 'GRIS ESPACIAL',
        'STARLIGHT' => 'ESTELAR',
        'TEAL' => 'VERDE AZULADO',
        'ULTRAMARINE' => 'ULTRAMARINO',
        'WHITE' => 'BLANCO',
        'WHITE TITANIUM' => 'TITANIO BLANCO',
        'YELLOW' => 'AMARILLO',
    ];

    public function up(): void
    {
        if (! $this->tablesReady()) {
            return;
        }

        DB::transaction(function () {
            foreach (self::RENAME_MAP as $from => $to) {
                $this->mergeColorName($from, $to);
            }

            (new DeviceColorSeeder)->run();
        });
    }

    public function down(): void
    {
        // No revertir: los nombres en español pueden estar en uso en inventario.
    }

    private function tablesReady(): bool
    {
        return DB::getSchemaBuilder()->hasTable('device_colors')
            && DB::getSchemaBuilder()->hasTable('inventory_items');
    }

    private function mergeColorName(string $from, string $to): void
    {
        $fromColor = DeviceColor::query()->where('name', $from)->first();
        if (! $fromColor) {
            $this->replaceInventoryColor($from, $to);

            return;
        }

        $toColor = DeviceColor::query()->where('name', $to)->first();

        if ($toColor && $toColor->id !== $fromColor->id) {
            $this->replaceInventoryColor($from, $to);
            $fromColor->delete();

            return;
        }

        $fromColor->update(['name' => $to]);
        $this->replaceInventoryColor($from, $to);
    }

    private function replaceInventoryColor(string $from, string $to): void
    {
        DB::table('inventory_items')
            ->where('color', $from)
            ->update(['color' => $to, 'updated_at' => now()]);

        InventoryProduct::query()
            ->where('color', $from)
            ->get()
            ->each(function (InventoryProduct $product) use ($from, $to) {
                $product->update([
                    'color' => $to,
                    'name' => $product->name ? str_replace($from, $to, $product->name) : $product->name,
                ]);
            });
    }
};

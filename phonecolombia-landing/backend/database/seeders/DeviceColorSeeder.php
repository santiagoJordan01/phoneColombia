<?php

namespace Database\Seeders;

use App\Models\DeviceColor;
use Illuminate\Database\Seeder;
use RuntimeException;

class DeviceColorSeeder extends Seeder
{
    public function run(): void
    {
        $path = dirname(base_path()).DIRECTORY_SEPARATOR.'src'.DIRECTORY_SEPARATOR.'data'.DIRECTORY_SEPARATOR.'apple-device-colors.json';

        if (! is_readable($path)) {
            throw new RuntimeException("No se encontró el catálogo de colores Apple: {$path}");
        }

        $colors = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);

        foreach ($colors as $color) {
            DeviceColor::firstOrCreate(['name' => $color['name']]);
        }
    }
}

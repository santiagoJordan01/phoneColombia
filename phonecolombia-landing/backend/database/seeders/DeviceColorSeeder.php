<?php

namespace Database\Seeders;

use App\Models\DeviceColor;
use Illuminate\Database\Seeder;

class DeviceColorSeeder extends Seeder
{
    public function run(): void
    {
        $colors = [
            'NEGRO', 'BLANCO', 'DORADO', 'AZUL', 'VERDE', 'ROJO', 'MORADO', 'ROSADO',
            'NATURAL', 'NARANJA', 'LILA', 'DESERT', 'GRIS', 'PLATA', 'MIDNIGHT',
            'STARLIGHT', 'GRAPHITE', 'VERDE OLIVA', 'AZUL SIERRA', 'AZUL PACÍFICO',
            'PURPLE', 'TITANIO', 'TITANIO NEGRO', 'TITANIO BLANCO', 'TITANIO DESERT',
            'CORAL', 'AMARILLO', 'CREMA',
        ];

        foreach ($colors as $name) {
            DeviceColor::firstOrCreate(['name' => $name]);
        }
    }
}

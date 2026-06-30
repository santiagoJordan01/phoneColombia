<?php

namespace Database\Seeders;

use App\Models\CreditPaymentMethod;
use App\Models\CreditSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CreditPaymentMethodSeeder extends Seeder
{
    public function run(): void
    {
        CreditSetting::query()->firstOrCreate([], ['billing_day' => 15]);

        $defaults = [
            ['name' => 'Addi', 'slug' => 'addi'],
            ['name' => 'Sistecredito', 'slug' => 'sistecredito'],
            ['name' => 'Cupón', 'slug' => 'cupon'],
            ['name' => 'Transferencia', 'slug' => 'transferencia'],
            ['name' => 'Tarjeta corporativa', 'slug' => 'tarjeta_corporativa'],
        ];

        foreach ($defaults as $index => $row) {
            CreditPaymentMethod::query()->updateOrCreate(
                ['slug' => $row['slug']],
                [
                    'name' => $row['name'],
                    'is_active' => true,
                    'sort_order' => $index + 1,
                ],
            );
        }
    }
}

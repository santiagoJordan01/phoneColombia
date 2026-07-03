<?php

namespace Database\Seeders;

use App\Support\IphoneModelCatalog;
use Illuminate\Database\Seeder;

class IphoneModelSeeder extends Seeder
{
    public function run(): void
    {
        IphoneModelCatalog::seedMissing();
    }
}

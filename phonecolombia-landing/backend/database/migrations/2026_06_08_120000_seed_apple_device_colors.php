<?php

use Database\Seeders\DeviceColorSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        (new DeviceColorSeeder)->run();
    }

    public function down(): void
    {
        // Los colores pueden estar en uso en inventario; no se eliminan al revertir.
    }
};

<?php

use App\Support\IphoneModelCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        IphoneModelCatalog::seedMissing();
    }

    public function down(): void
    {
        // No se eliminan modelos ya usados en inventario.
    }
};

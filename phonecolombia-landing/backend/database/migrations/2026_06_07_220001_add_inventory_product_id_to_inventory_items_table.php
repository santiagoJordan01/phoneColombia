<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->uuid('inventory_product_id')->nullable()->after('id');
            $table->foreign('inventory_product_id')
                ->references('id')
                ->on('inventory_products')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropForeign(['inventory_product_id']);
            $table->dropColumn('inventory_product_id');
        });
    }
};

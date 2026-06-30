<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('purchase_price_at_sale', 50)->nullable()->after('sale_price');
        });

        if (Schema::hasTable('sales') && Schema::hasTable('inventory_items')) {
            $pairs = DB::table('sales')
                ->join('inventory_items', 'sales.inventory_item_id', '=', 'inventory_items.id')
                ->whereNull('sales.purchase_price_at_sale')
                ->select('sales.id', 'inventory_items.purchase_price')
                ->get();

            foreach ($pairs as $row) {
                DB::table('sales')->where('id', $row->id)->update([
                    'purchase_price_at_sale' => $row->purchase_price,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('purchase_price_at_sale');
        });
    }
};

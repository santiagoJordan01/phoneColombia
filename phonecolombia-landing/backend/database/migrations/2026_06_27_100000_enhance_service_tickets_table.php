<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_tickets', function (Blueprint $table) {
            $table->dropForeign(['inventory_item_id']);
        });

        Schema::table('service_tickets', function (Blueprint $table) {
            $table->string('ticket_type', 30)->default('inventario')->after('inventory_item_id');
            $table->string('device_name')->nullable()->after('ticket_type');
            $table->string('device_reference', 64)->nullable()->after('device_name');
            $table->string('workshop', 120)->nullable()->after('assigned_user_id');
            $table->string('service_category', 60)->nullable()->after('issue_description');
            $table->decimal('repair_cost', 14, 2)->nullable()->after('repair_notes');
            $table->decimal('customer_price', 14, 2)->nullable()->after('repair_cost');
            $table->boolean('is_warranty')->default(false)->after('customer_price');
            $table->string('customer_name', 120)->nullable()->after('is_warranty');
            $table->string('customer_phone', 30)->nullable()->after('customer_name');
        });

        Schema::table('service_tickets', function (Blueprint $table) {
            $table->uuid('inventory_item_id')->nullable()->change();
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('service_tickets', function (Blueprint $table) {
            $table->dropForeign(['inventory_item_id']);
        });

        Schema::table('service_tickets', function (Blueprint $table) {
            $table->dropColumn([
                'ticket_type',
                'device_name',
                'device_reference',
                'workshop',
                'service_category',
                'repair_cost',
                'customer_price',
                'is_warranty',
                'customer_name',
                'customer_phone',
            ]);
        });

        Schema::table('service_tickets', function (Blueprint $table) {
            $table->uuid('inventory_item_id')->nullable(false)->change();
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_tickets', function (Blueprint $table) {
            $table->foreignUuid('service_customer_id')->nullable()->after('inventory_item_id')->constrained('service_customers')->nullOnDelete();
            $table->foreignUuid('service_category_id')->nullable()->after('issue_description')->constrained('service_categories')->nullOnDelete();
            $table->foreignUuid('service_technician_id')->nullable()->after('assigned_user_id')->constrained('service_technicians')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('service_tickets', function (Blueprint $table) {
            $table->dropForeign(['service_customer_id']);
            $table->dropForeign(['service_category_id']);
            $table->dropForeign(['service_technician_id']);
            $table->dropColumn(['service_customer_id', 'service_category_id', 'service_technician_id']);
        });
    }
};

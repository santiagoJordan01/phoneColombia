<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->timestamp('acquired_at')->nullable()->after('notes');
            $table->foreignUuid('supplier_id')->nullable()->after('supplier')->constrained('suppliers')->nullOnDelete();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropForeign(['supplier_id']);
            $table->dropColumn(['acquired_at', 'supplier_id', 'deleted_at']);
        });
    }
};

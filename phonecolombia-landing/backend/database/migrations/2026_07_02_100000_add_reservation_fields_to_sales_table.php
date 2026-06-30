<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('reservation_status', 20)->nullable()->after('credit_status');
            $table->timestamp('reserved_at')->nullable()->after('sold_at');
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->timestamp('sold_at')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['reservation_status', 'reserved_at']);
        });
    }
};

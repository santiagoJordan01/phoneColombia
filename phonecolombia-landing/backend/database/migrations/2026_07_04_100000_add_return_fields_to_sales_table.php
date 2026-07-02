<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->timestamp('returned_at')->nullable()->after('sold_at');
            $table->string('retake_price', 50)->nullable()->after('returned_at');
            $table->string('retake_payment_method', 30)->nullable()->after('retake_price');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['returned_at', 'retake_price', 'retake_payment_method']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->foreignUuid('credit_payment_method_id')
                ->nullable()
                ->after('payment_method')
                ->constrained('credit_payment_methods')
                ->nullOnDelete();
            $table->string('credit_term_type', 20)->nullable()->after('credit_payment_method_id');
            $table->timestamp('credit_due_at')->nullable()->after('credit_term_type');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropConstrainedForeignId('credit_payment_method_id');
            $table->dropColumn(['credit_term_type', 'credit_due_at']);
        });
    }
};

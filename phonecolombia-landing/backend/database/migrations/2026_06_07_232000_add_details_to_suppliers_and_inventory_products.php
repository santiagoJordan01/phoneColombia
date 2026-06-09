<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('contact_name')->nullable()->after('name');
            $table->string('phone', 30)->nullable()->after('contact_name');
            $table->string('email')->nullable()->after('phone');
            $table->string('city', 100)->nullable()->after('email');
            $table->string('address')->nullable()->after('city');
            $table->text('notes')->nullable()->after('address');
        });

        Schema::table('inventory_products', function (Blueprint $table) {
            $table->string('brand', 80)->nullable()->after('category');
            $table->string('model', 120)->nullable()->after('brand');
            $table->string('storage', 50)->nullable()->after('model');
            $table->string('color', 50)->nullable()->after('storage');
            $table->string('reference_price', 50)->nullable()->after('color');
            $table->text('notes')->nullable()->after('reference_price');
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn(['contact_name', 'phone', 'email', 'city', 'address', 'notes']);
        });

        Schema::table('inventory_products', function (Blueprint $table) {
            $table->dropColumn(['brand', 'model', 'storage', 'color', 'reference_price', 'notes']);
        });
    }
};

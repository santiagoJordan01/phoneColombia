<?php

use App\Support\ServiceTicketCategory;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $order = 0;
        foreach (ServiceTicketCategory::LABELS as $slug => $name) {
            DB::table('service_categories')->insert([
                'id' => (string) Str::uuid(),
                'name' => $name,
                'slug' => $slug,
                'sort_order' => $order++,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $workshops = ['BLACK PHONE', 'IMEI', 'ALTA GAMA', 'CASTILLO', 'SMART TECH'];
        foreach ($workshops as $workshop) {
            DB::table('service_technicians')->insert([
                'id' => (string) Str::uuid(),
                'name' => $workshop,
                'workshop' => $workshop,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('service_categories')->truncate();
        DB::table('service_technicians')->truncate();
    }
};

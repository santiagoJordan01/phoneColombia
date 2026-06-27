<?php

use App\Support\ServiceTicketStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_ticket_states', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 120);
            $table->string('slug', 60)->unique();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->boolean('marks_in_service')->default(false);
            $table->boolean('releases_inventory')->default(false);
            $table->timestamps();
        });

        $now = now();
        $rows = [
            [
                'id' => (string) Str::uuid(),
                'name' => 'Proceso de revisión',
                'slug' => ServiceTicketStatus::PROCESO_REVISION,
                'sort_order' => 1,
                'is_active' => true,
                'is_default' => true,
                'marks_in_service' => false,
                'releases_inventory' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Esperando repuestos',
                'slug' => ServiceTicketStatus::ESPERANDO_REPUESTOS,
                'sort_order' => 2,
                'is_active' => true,
                'is_default' => false,
                'marks_in_service' => true,
                'releases_inventory' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Servicio técnico',
                'slug' => ServiceTicketStatus::SERVICIO_TECNICO,
                'sort_order' => 3,
                'is_active' => true,
                'is_default' => false,
                'marks_in_service' => true,
                'releases_inventory' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Servicio realizado',
                'slug' => ServiceTicketStatus::SERVICIO_REALIZADO,
                'sort_order' => 4,
                'is_active' => true,
                'is_default' => false,
                'marks_in_service' => false,
                'releases_inventory' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('service_ticket_states')->insert($rows);
    }

    public function down(): void
    {
        Schema::dropIfExists('service_ticket_states');
    }
};

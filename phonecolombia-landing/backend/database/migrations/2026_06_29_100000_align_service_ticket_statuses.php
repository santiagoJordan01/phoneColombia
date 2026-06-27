<?php

use App\Support\ServiceTicketStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $map = [
            'en_revision' => ServiceTicketStatus::PROCESO_REVISION,
            'ingresado' => ServiceTicketStatus::PROCESO_REVISION,
            'en_reparacion' => ServiceTicketStatus::SERVICIO_TECNICO,
            'listo' => ServiceTicketStatus::SERVICIO_REALIZADO,
            'entregado' => ServiceTicketStatus::SERVICIO_REALIZADO,
            'cancelado' => ServiceTicketStatus::PROCESO_REVISION,
        ];

        foreach ($map as $from => $to) {
            DB::table('service_tickets')->where('status', $from)->update(['status' => $to]);
        }
    }

    public function down(): void
    {
        $map = [
            ServiceTicketStatus::PROCESO_REVISION => 'en_revision',
            ServiceTicketStatus::ESPERANDO_REPUESTOS => 'en_revision',
            ServiceTicketStatus::SERVICIO_TECNICO => 'en_reparacion',
            ServiceTicketStatus::SERVICIO_REALIZADO => 'listo',
        ];

        foreach ($map as $from => $to) {
            DB::table('service_tickets')->where('status', $from)->update(['status' => $to]);
        }
    }
};

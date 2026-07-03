<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\ServiceCustomer;
use App\Models\ServiceTicket;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ResetOperationalDataCommand extends Command
{
    protected $signature = 'operational:reset {--force : Ejecutar sin confirmación}';

    protected $description = 'Elimina ventas, equipos, movimientos, auditoría y tickets ST; conserva catálogos (modelos, colores, marcas, proveedores, usuarios)';

    public function handle(): int
    {
        if (! $this->option('force') && ! $this->confirm('¿Eliminar ventas, equipos y datos operativos de prueba? Los catálogos se conservan.', false)) {
            $this->warn('Operación cancelada.');

            return self::FAILURE;
        }

        $counts = [
            'sale_payments' => SalePayment::query()->count(),
            'sales' => Sale::query()->count(),
            'service_tickets' => ServiceTicket::query()->count(),
            'inventory_movements' => InventoryMovement::query()->count(),
            'audit_logs' => AuditLog::query()->count(),
            'inventory_items' => InventoryItem::withTrashed()->count(),
            'service_customers' => ServiceCustomer::query()->count(),
        ];

        DB::transaction(function () {
            SalePayment::query()->delete();
            Sale::query()->delete();
            ServiceTicket::query()->delete();
            InventoryMovement::query()->delete();
            AuditLog::query()->delete();
            ServiceCustomer::query()->delete();
            InventoryItem::withTrashed()->forceDelete();
        });

        $this->info('Base de datos operativa limpiada.');
        $this->table(
            ['Tabla', 'Registros eliminados'],
            collect($counts)->map(fn (int $count, string $table) => [$table, $count])->values()->all(),
        );

        $this->newLine();
        $this->line('Conservado: usuarios, modelos (inventory_products), colores, marcas, proveedores,');
        $this->line('medios de crédito, catálogos ST (categorías, técnicos, estados), CMS del sitio.');

        return self::SUCCESS;
    }
}

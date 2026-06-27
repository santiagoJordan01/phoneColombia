<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Supplier;
use App\Models\User;
use App\Services\AuditService;
use App\Services\InventoryMovementService;
use App\Support\InventoryStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryImportExportController extends Controller
{
    use ScopesInventoryForUser;

    public function __construct(
        private InventoryMovementService $movements,
        private AuditService $audit,
    ) {}

    public function import(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->resolvedRole(), [User::ROLE_SUPER_ADMIN, User::ROLE_INVENTORY], true)) {
            return response()->json(['message' => 'No tienes permiso para importar.'], 403);
        }

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        $header = fgetcsv($handle);
        $created = 0;
        $skipped = 0;
        $errors = [];

        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) < 2) {
                $skipped++;
                continue;
            }

            $map = $this->mapCsvRow($header, $row);
            if (empty($map['name']) && empty($map['imei'])) {
                $skipped++;
                continue;
            }

            if (! empty($map['imei'])) {
                $exists = InventoryItem::query()->where('imei', $map['imei'])->exists();
                if ($exists) {
                    $errors[] = "IMEI duplicado: {$map['imei']}";
                    $skipped++;
                    continue;
                }
            }

            if (! empty($map['barcode'])) {
                $exists = InventoryItem::query()->where('barcode', $map['barcode'])->exists();
                if ($exists) {
                    $errors[] = "Código de barras duplicado: {$map['barcode']}";
                    $skipped++;
                    continue;
                }
            }

            if (! empty($map['supplier']) && empty($map['supplier_id'])) {
                $supplier = Supplier::firstOrCreate(['name' => $map['supplier']]);
                $map['supplier_id'] = $supplier->id;
            }

            $item = InventoryItem::create([
                'imei' => $map['imei'] ?? null,
                'barcode' => $map['barcode'] ?? null,
                'name' => $map['name'] ?? 'Sin nombre',
                'color' => $map['color'] ?? null,
                'supplier' => $map['supplier'] ?? null,
                'supplier_id' => $map['supplier_id'] ?? null,
                'purchase_price' => $map['purchase_price'] ?? null,
                'sale_price' => $map['sale_price'] ?? null,
                'battery' => $map['battery'] ?? null,
                'status' => $map['status'] ?? InventoryStatus::DISPONIBLE,
                'notes' => $map['notes'] ?? null,
                'acquired_at' => $map['acquired_at'] ?? now(),
                'quantity' => 1,
            ]);

            $this->movements->record($item, 'ingreso', null, null, $item->status, 'Importación Excel/CSV');
            $created++;
        }

        fclose($handle);
        $this->audit->logSystem('import', [
            'created' => $created,
            'skipped' => $skipped,
            'errors' => $errors,
        ]);

        return response()->json([
            'message' => "Importación completada: {$created} creados, {$skipped} omitidos.",
            'created' => $created,
            'skipped' => $skipped,
            'errors' => $errors,
        ]);
    }

    public function template(): JsonResponse
    {
        return response()->json([
            'columns' => ['Código barras', 'IMEI', 'Equipo', 'Color', 'Proveedor', 'Precio compra', 'Precio venta', 'Batería', 'Estado', 'Fecha ingreso', 'Notas'],
            'example' => ['7701234567890', '352099001761481', 'IPHONE 13 128GB', 'Negro', 'Proveedor ABC', '2500000', '3200000', '87', 'disponible', '2026-06-01', ''],
            'statuses' => InventoryStatus::ALL,
        ]);
    }

    private function mapCsvRow(?array $header, array $row): array
    {
        if (! $header) {
            return [
                'barcode' => $row[0] ?? null,
                'imei' => $row[1] ?? null,
                'name' => $row[2] ?? null,
                'color' => $row[3] ?? null,
                'supplier' => $row[4] ?? null,
                'purchase_price' => $row[5] ?? null,
                'sale_price' => $row[6] ?? null,
                'battery' => isset($row[7]) && $row[7] !== '' ? (int) $row[7] : null,
                'status' => $row[8] ?? null,
                'acquired_at' => $row[9] ?? null,
                'notes' => $row[10] ?? null,
            ];
        }

        $normalized = [];
        foreach ($header as $i => $col) {
            $key = strtolower(trim($col));
            $normalized[$key] = $row[$i] ?? null;
        }

        return [
            'barcode' => $normalized['código barras'] ?? $normalized['codigo barras'] ?? $normalized['barcode'] ?? $normalized['codigo de barras'] ?? null,
            'imei' => $normalized['imei'] ?? null,
            'name' => $normalized['equipo'] ?? $normalized['name'] ?? null,
            'color' => $normalized['color'] ?? null,
            'supplier' => $normalized['proveedor'] ?? $normalized['supplier'] ?? null,
            'purchase_price' => $normalized['precio compra'] ?? $normalized['purchase_price'] ?? null,
            'sale_price' => $normalized['precio venta'] ?? $normalized['sale_price'] ?? null,
            'battery' => isset($normalized['batería']) || isset($normalized['bateria']) || isset($normalized['battery'])
                ? (int) ($normalized['batería'] ?? $normalized['bateria'] ?? $normalized['battery'])
                : null,
            'status' => $normalized['estado'] ?? $normalized['status'] ?? null,
            'acquired_at' => $normalized['fecha ingreso'] ?? $normalized['acquired_at'] ?? null,
            'notes' => $normalized['notas'] ?? $normalized['notes'] ?? null,
        ];
    }
}

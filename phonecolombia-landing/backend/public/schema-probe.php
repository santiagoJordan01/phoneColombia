<?php
/**
 * Verifica tablas/columnas que inventario e informes necesitan.
 * Abre: https://api.phonecolombia.com/schema-probe.php
 * BORRA cuando termines.
 */
header('Content-Type: text/plain; charset=utf-8');

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';

function out(string $msg): void
{
    echo $msg;
    if (function_exists('flush')) {
        flush();
    }
}

out("=== Schema probe (inventario + informes) ===\n\n");

$env = [];
foreach (file($root . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
        continue;
    }
    [$k, $v] = explode('=', $line, 2);
    $env[trim($k)] = trim($v, " \t\"'");
}

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $env['DB_HOST'] ?? 'localhost', $env['DB_DATABASE'] ?? ''),
        $env['DB_USERNAME'] ?? '',
        $env['DB_PASSWORD'] ?? '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (Throwable $e) {
    out('MySQL ERROR: ' . $e->getMessage() . "\n");
    exit;
}

$tables = [
    'suppliers', 'sales', 'sale_payments', 'inventory_items', 'inventory_products',
    'inventory_movements', 'service_ticket_states', 'service_technicians',
    'service_customers', 'service_tickets', 'credit_payment_methods', 'credit_settings',
    'device_brands', 'device_colors', 'audit_logs',
];

out("--- Tablas ---\n");
$missingTables = [];
foreach ($tables as $table) {
    $stmt = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table));
    $ok = $stmt->fetch() !== false;
    out(sprintf("  %-28s %s\n", $table, $ok ? 'OK' : 'FALTA'));
    if (!$ok) {
        $missingTables[] = $table;
    }
}

$columnChecks = [
    'sales' => [
        'amount_due', 'amount_paid', 'credit_status', 'sold_at', 'reservation_status',
        'reserved_at', 'returned_at', 'credit_payment_method_id', 'credit_due_at',
        'service_customer_id', 'remission_number', 'purchase_price_at_sale',
    ],
    'inventory_items' => [
        'deleted_at', 'supplier_id', 'inventory_product_id', 'barcode', 'acquired_at',
    ],
    'users' => ['role', 'supplier_id', 'service_technician_id'],
];

out("\n--- Columnas críticas ---\n");
$missingCols = [];
foreach ($columnChecks as $table => $columns) {
    $stmt = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table));
    if ($stmt->fetch() === false) {
        continue;
    }
    $existing = $pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($columns as $col) {
        $ok = in_array($col, $existing, true);
        if (!$ok) {
            out("  $table.$col FALTA\n");
            $missingCols[] = "$table.$col";
        }
    }
}
if ($missingCols === []) {
    out("  Todas las columnas críticas existen.\n");
}

$migrations = $pdo->query('SELECT migration FROM migrations ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);
out("\n--- Migraciones aplicadas: " . count($migrations) . " ---\n");
out("  Últimas 8:\n");
foreach (array_slice($migrations, -8) as $m) {
    out("    - $m\n");
}

$expected = count(glob($root . '/database/migrations/*.php'));
out("\n  Archivos en código: $expected\n");
if (count($migrations) < $expected) {
    out("  >>> AVISO: faltan migraciones en producción (" . count($migrations) . "/$expected)\n");
}

if ($missingTables !== [] || $missingCols !== []) {
    out("\n>>> CAUSA PROBABLE DEL HTTP 500 EN /api/inventory y /api/reports/*\n");
    out("    La BD de producción no está al día con el código desplegado.\n");
    out("    Aplica las migraciones pendientes o importa un dump actualizado.\n");
} else {
    out("\nEsquema OK. Si sigue el 500, revisa storage/logs/laravel.log\n");
}

out("\n=== Fin. Borra schema-probe.php del servidor. ===\n");

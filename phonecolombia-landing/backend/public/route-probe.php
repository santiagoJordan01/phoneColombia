<?php
/**
 * Detecta qué clase revienta al cargar rutas/controladores.
 * Abre: https://api.phonecolombia.com/route-probe.php
 * BORRA cuando termines.
 */
header('Content-Type: text/plain; charset=utf-8');
ini_set('display_errors', '1');
error_reporting(E_ALL);

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        echo "\nFATAL: {$err['message']}\n{$err['file']}:{$err['line']}\n";
    }
});

function out(string $msg): void
{
    echo $msg;
    if (function_exists('flush')) {
        flush();
    }
}

out("=== Route probe ===\n\n");

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';

out("1) autoload OK\n");

$app = require $root . '/bootstrap/app.php';
out("2) app bootstrap OK\n");

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
out("2b) kernel instance OK\n");

$bootstrappers = [
    Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables::class,
    Illuminate\Foundation\Bootstrap\LoadConfiguration::class,
    Illuminate\Foundation\Bootstrap\HandleExceptions::class,
    Illuminate\Foundation\Bootstrap\RegisterFacades::class,
    Illuminate\Foundation\Bootstrap\RegisterProviders::class,
    Illuminate\Foundation\Bootstrap\BootProviders::class,
];

foreach ($bootstrappers as $bootstrapper) {
    $short = class_basename($bootstrapper);
    out("   boot:$short ... ");
    try {
        $app->bootstrapWith([$bootstrapper]);
        out("OK\n");
    } catch (Throwable $e) {
        out("FALLÓ: {$e->getMessage()}\n");
        exit(1);
    }
}
out("2c) HTTP kernel boot OK\n");

$manualPass = null;
$laravelPass = null;
foreach (file($root . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if (str_starts_with($line, 'DB_PASSWORD=')) {
        $manualPass = trim(substr($line, strlen('DB_PASSWORD=')), " \t\"'");
    }
}

$laravelPass = $app->make('config')->get('database.connections.mysql.password');
out('3) DB_PASSWORD manual parse: ' . ($manualPass !== '' ? 'set (' . strlen((string) $manualPass) . ' chars)' : 'EMPTY') . "\n");
out('   DB_PASSWORD Laravel config: ' . ($laravelPass !== '' && $laravelPass !== null ? 'set (' . strlen((string) $laravelPass) . ' chars)' : 'EMPTY') . "\n");
if ((string) $manualPass !== (string) $laravelPass) {
    out("   >>> AVISO: Laravel lee distinta contraseña. Pon DB_PASSWORD entre comillas en .env\n");
}

try {
    $app->make('db')->connection()->getPdo();
    out("4) Laravel DB connection OK\n");
} catch (Throwable $e) {
    out("4) Laravel DB FALLÓ: {$e->getMessage()}\n");
}

$controllers = [
    'App\Http\Controllers\Api\ProductController',
    'App\Http\Controllers\Api\PromocionController',
    'App\Http\Controllers\Api\TestimonioController',
    'App\Http\Controllers\Api\SiteSettingController',
    'App\Http\Controllers\Api\AuthController',
    'App\Http\Controllers\Api\ReportController',
    'App\Http\Controllers\Api\SaleController',
    'App\Http\Controllers\Api\InventoryItemController',
    'App\Http\Controllers\Api\BootstrapController',
];

out("\n5) Cargando controladores:\n");
foreach ($controllers as $class) {
    out("   $class ... ");
    try {
        if (!class_exists($class)) {
            out("NO EXISTE\n");
            continue;
        }
        out("OK\n");
    } catch (Throwable $e) {
        out("ERROR: {$e->getMessage()}\n");
    }
}

$services = [
    'App\Services\DailySalesReportExporter',
    'App\Services\BySellerReportExporter',
    'Barryvdh\DomPDF\ServiceProvider',
    'PhpOffice\PhpSpreadsheet\Spreadsheet',
];

out("\n6) Dependencias pesadas:\n");
foreach ($services as $class) {
    out("   $class ... ");
    try {
        class_exists($class);
        out("OK\n");
    } catch (Throwable $e) {
        out("ERROR: {$e->getMessage()}\n");
    }
}

out("\n7) Cargando routes/api.php ...\n");
try {
    $router = $app->make('router');
    require $root . '/routes/api.php';
    out("   routes/api.php OK (" . count($router->getRoutes()) . " rutas)\n");
} catch (Throwable $e) {
    out("   ERROR: {$e->getMessage()}\n");
    out('   ' . $e->getFile() . ':' . $e->getLine() . "\n");
}

out("\n8) Product::count via Eloquent ... ");
try {
    $count = App\Models\Product::query()->count();
    out("OK ($count)\n");
} catch (Throwable $e) {
    out("ERROR: {$e->getMessage()}\n");
}

out("\n=== Fin. Borra route-probe.php del servidor. ===\n");

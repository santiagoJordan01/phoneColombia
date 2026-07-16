<?php
/**
 * Identifica en qué bootstrapper o service provider revienta Laravel.
 * Abre: https://api.phonecolombia.com/boot-probe.php
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
        @ob_flush();
        flush();
    }
}

out("=== Boot probe ===\n\n");

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
out("autoload OK\n\n");

$bootstrappers = [
    Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables::class,
    Illuminate\Foundation\Bootstrap\LoadConfiguration::class,
    Illuminate\Foundation\Bootstrap\HandleExceptions::class,
    Illuminate\Foundation\Bootstrap\RegisterFacades::class,
    Illuminate\Foundation\Bootstrap\RegisterProviders::class,
    Illuminate\Foundation\Bootstrap\BootProviders::class,
];

$app = require $root . '/bootstrap/app.php';

out("--- Bootstrappers HTTP (uno a uno) ---\n");
foreach ($bootstrappers as $bootstrapper) {
    $short = class_basename($bootstrapper);
    out(">> $short ... ");
    try {
        $app->bootstrapWith([$bootstrapper]);
        out("OK\n");
    } catch (Throwable $e) {
        out("FALLÓ\n");
        out("   {$e->getMessage()}\n");
        out("   {$e->getFile()}:{$e->getLine()}\n");
        exit(1);
    }
}

out("\n--- Contraseña BD ---\n");
$manualPass = null;
foreach (file($root . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if (str_starts_with($line, 'DB_PASSWORD=')) {
        $manualPass = trim(substr($line, strlen('DB_PASSWORD=')), " \t\"'");
    }
}
$laravelPass = $app->make('config')->get('database.connections.mysql.password');
out('manual: ' . strlen((string) $manualPass) . " chars | Laravel: " . strlen((string) $laravelPass) . " chars\n");
if ((string) $manualPass !== (string) $laravelPass) {
    out(">>> AVISO: contraseñas distintas — usa DB_PASSWORD=\"...\" en .env\n");
}

out("\n--- Eager providers (si BootProviders falló arriba, no llegas aquí) ---\n");
$servicesFile = $root . '/bootstrap/cache/services.php';
if (!file_exists($servicesFile)) {
    out("services.php no existe\n");
} else {
    $services = require $servicesFile;
    foreach ($services['eager'] ?? [] as $provider) {
        out("   $provider ... ");
        try {
            if (!class_exists($provider)) {
                out("CLASE NO ENCONTRADA\n");
                continue;
            }
            out("OK (ya booted)\n");
        } catch (Throwable $e) {
            out("ERROR: {$e->getMessage()}\n");
        }
    }
}

out("\n--- Prueba Eloquent products ---\n");
try {
    $app->make('db')->connection()->getPdo();
    out("DB PDO OK\n");
    $count = App\Models\Product::query()->count();
    out("Product::count = $count\n");
} catch (Throwable $e) {
    out("DB/Eloquent FALLÓ: {$e->getMessage()}\n");
}

out("\n--- Petición /api/products ---\n");
try {
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    $request = Illuminate\Http\Request::create('/api/products', 'GET', [], [], [], [
        'HTTP_ACCEPT' => 'application/json',
    ]);
    $response = $kernel->handle($request);
    out('HTTP ' . $response->getStatusCode() . "\n");
    out(substr($response->getContent(), 0, 300) . "\n");
    $kernel->terminate($request, $response);
} catch (Throwable $e) {
    out("HANDLE FALLÓ: {$e->getMessage()}\n");
    out("{$e->getFile()}:{$e->getLine()}\n");
}

out("\n=== Fin. Borra boot-probe.php del servidor. ===\n");

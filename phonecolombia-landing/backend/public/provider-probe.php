<?php
/**
 * Si BootProviders falla: prueba cada provider eager por separado en app limpia.
 * Abre: https://api.phonecolombia.com/provider-probe.php
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

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';

$servicesFile = $root . '/bootstrap/cache/services.php';
if (!file_exists($servicesFile)) {
    out("Falta bootstrap/cache/services.php\n");
    exit;
}

$services = require $servicesFile;
$eager = $services['eager'] ?? [];

out("=== Provider probe (" . count($eager) . " eager) ===\n\n");

$preBoot = [
    Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables::class,
    Illuminate\Foundation\Bootstrap\LoadConfiguration::class,
    Illuminate\Foundation\Bootstrap\HandleExceptions::class,
    Illuminate\Foundation\Bootstrap\RegisterFacades::class,
];

foreach ($eager as $provider) {
    out("--- Probando: $provider ---\n");
    try {
        $app = require $root . '/bootstrap/app.php';
        $app->bootstrapWith($preBoot);
        $app->register($provider);
        $instance = $app->getProvider($provider);
        if ($instance) {
            $app->bootProvider($instance);
        }
        out("OK\n\n");
    } catch (Throwable $e) {
        out("FALLÓ: {$e->getMessage()}\n");
        out("{$e->getFile()}:{$e->getLine()}\n\n");
    }
}

out("=== Fin. Borra provider-probe.php del servidor. ===\n");

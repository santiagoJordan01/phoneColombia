<?php
/**
 * Captura errores fatales al procesar /api/products paso a paso.
 * Abre: https://api.phonecolombia.com/error-capture.php
 * BORRA este archivo cuando termines.
 */
header('Content-Type: text/plain; charset=utf-8');
ini_set('display_errors', '1');
error_reporting(E_ALL);

function out(string $msg): void
{
    echo $msg;
    if (function_exists('flush')) {
        flush();
    }
}

out("=== Captura de errores HTTP ===\n\n");

$fatal = null;
register_shutdown_function(function () use (&$fatal) {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        echo "\n\n=== ERROR FATAL ===\n";
        echo $err['message'] . "\n";
        echo $err['file'] . ':' . $err['line'] . "\n";
    }
});

$root = dirname(__DIR__);

function step(string $label, callable $fn): void
{
    out(">> $label ... ");
    try {
        $fn();
        out("OK\n");
    } catch (Throwable $e) {
        out("FALLÓ\n");
        out("   " . $e->getMessage() . "\n");
        out('   ' . $e->getFile() . ':' . $e->getLine() . "\n");
        exit(1);
    }
}

step('autoload', function () use ($root) {
    require $root . '/vendor/autoload.php';
});

$app = null;
step('bootstrap app', function () use ($root, &$app) {
    $app = require $root . '/bootstrap/app.php';
});

step('make kernel', function () use (&$app, &$kernel) {
    global $kernel;
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
});

step('boot providers (handle internals)', function () use (&$kernel) {
    $ref = new ReflectionClass($kernel);
    $method = $ref->getMethod('bootstrap');
    $method->setAccessible(true);
    $method->invoke($kernel);
});

step('Product::query()->count()', function () use (&$app) {
    $app->make('db')->connection()->getPdo();
    $count = App\Models\Product::query()->count();
    echo "(productos: $count) ";
});

step('GET /api/products', function () use (&$kernel) {
    $request = Illuminate\Http\Request::create('/api/products', 'GET', [], [], [], [
        'HTTP_ORIGIN' => 'https://phonecolombia.com',
        'HTTP_ACCEPT' => 'application/json',
    ]);
    $response = $kernel->handle($request);
    echo "(HTTP {$response->getStatusCode()}) ";
    $body = $response->getContent();
    echo substr($body, 0, 200);
    $kernel->terminate($request, $response);
});

echo "\n=== Todo OK. Borra error-capture.php del servidor. ===\n";

<?php
/**
 * Diagnóstico Hostinger — sube a public_html/backend/public/diag.php
 * Abre: https://api.phonecolombia.com/diag.php
 * BORRA este archivo cuando termines.
 */
header('Content-Type: text/plain; charset=utf-8');

echo "=== Phone Colombia API — diagnóstico ===\n\n";
echo 'PHP: ' . PHP_VERSION . "\n";
echo 'Fecha: ' . date('c') . "\n\n";

$root = dirname(__DIR__);

$paths = [
    'vendor/autoload.php' => $root . '/vendor/autoload.php',
    '.env' => $root . '/.env',
    'storage/logs' => $root . '/storage/logs',
    'bootstrap/cache' => $root . '/bootstrap/cache',
];

foreach ($paths as $label => $path) {
    $ok = file_exists($path);
    echo "$label: " . ($ok ? 'OK' : 'FALTA') . "\n";
    if ($label === 'storage/logs' || $label === 'bootstrap/cache') {
        echo "  escribible: " . (is_writable($path) ? 'SI' : 'NO') . "\n";
    }
}

echo "\nExtensiones PHP:\n";
foreach (['pdo_mysql', 'mbstring', 'openssl', 'fileinfo', 'zip', 'gd', 'intl', 'dom', 'xml'] as $ext) {
    echo "  $ext: " . (extension_loaded($ext) ? 'SI' : 'NO') . "\n";
}

echo "\n--- Conexión MySQL (.env) ---\n";
$envFile = $root . '/.env';
if (!file_exists($envFile)) {
    echo "No hay .env\n";
    exit;
}

$env = [];
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || str_starts_with($line, '#')) {
        continue;
    }
    if (str_contains($line, '=')) {
        [$k, $v] = explode('=', $line, 2);
        $env[trim($k)] = trim($v, " \t\"'");
    }
}

$host = $env['DB_HOST'] ?? 'localhost';
$db = $env['DB_DATABASE'] ?? '';
$user = $env['DB_USERNAME'] ?? '';
$pass = $env['DB_PASSWORD'] ?? '';

echo "DB_HOST: $host\n";
echo "DB_DATABASE: $db\n";
echo "DB_USERNAME: $user\n";
echo "DB_PASSWORD: " . ($pass !== '' ? '(configurada)' : 'VACÍA') . "\n";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "\nMySQL: CONECTADO\n";

    $tables = ['users', 'products', 'migrations', 'personal_access_tokens', 'inventory_products', 'device_brands'];
    echo "\nTablas:\n";
    foreach ($tables as $table) {
        $stmt = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table));
        $exists = $stmt->fetch() !== false;
        echo "  $table: " . ($exists ? 'SI' : 'NO') . "\n";
    }

    if ($pdo->query("SHOW TABLES LIKE 'users'")->fetch()) {
        $count = $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        echo "\nUsuarios en BD: $count\n";
    }
} catch (Throwable $e) {
    echo "\nMySQL ERROR: " . $e->getMessage() . "\n";
}

$cached = [
    'packages.php' => $root . '/bootstrap/cache/packages.php',
    'services.php' => $root . '/bootstrap/cache/services.php',
    'config.php' => $root . '/bootstrap/cache/config.php',
];
echo "\n--- Caché de bootstrap ---\n";
$badCache = false;
foreach ($cached as $label => $path) {
    $exists = file_exists($path);
    echo "$label: " . ($exists ? 'EXISTE' : 'no existe') . "\n";
    if ($exists && $label === 'packages.php') {
        $content = file_get_contents($path) ?: '';
        foreach (['Pail', 'Sail', 'Collision'] as $devPkg) {
            if (str_contains($content, $devPkg)) {
                echo "  AVISO: contiene $devPkg (caché de desarrollo — causa HTTP 500)\n";
                $badCache = true;
            }
        }
    }
}
if ($badCache) {
    echo "\n>>> SOLUCIÓN: sube y abre clear-bootstrap-cache.php o borra esos archivos por FTP.\n";
}

echo "\n--- Laravel bootstrap ---\n";
if (!file_exists($root . '/vendor/autoload.php')) {
    echo "Sin vendor — no se puede probar Laravel.\n";
    exit;
}

$fatal = null;
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        echo "\nERROR FATAL: {$err['message']}\n";
        echo "{$err['file']}:{$err['line']}\n";
    }
});

try {
    require $root . '/vendor/autoload.php';
    $app = require $root . '/bootstrap/app.php';
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    echo "Laravel kernel: OK\n";

    echo "\n--- Boot de providers (lo que hace handle()) ---\n";
    $ref = new ReflectionClass($kernel);
    $boot = $ref->getMethod('bootstrap');
    $boot->setAccessible(true);
    $boot->invoke($kernel);
    echo "Bootstrap HTTP: OK\n";

    echo "\n--- Consulta products ---\n";
    $count = App\Models\Product::query()->count();
    echo "Productos en BD: $count\n";

    echo "\n--- Petición HTTP de prueba (/api/products) ---\n";
    if ($badCache) {
        echo "Omitida: limpia bootstrap/cache antes.\n";
    } else {
        $request = Illuminate\Http\Request::create('/api/products', 'GET', [], [], [], [
            'HTTP_ORIGIN' => 'https://phonecolombia.com',
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $response = $kernel->handle($request);
        echo 'HTTP status: ' . $response->getStatusCode() . "\n";
        $body = $response->getContent();
        echo 'Body (primeros 500 chars): ' . substr($body, 0, 500) . "\n";
        $kernel->terminate($request, $response);
    }
} catch (Throwable $e) {
    echo "Laravel ERROR: " . $e->getMessage() . "\n";
    echo $e->getFile() . ':' . $e->getLine() . "\n";
}

$logDir = $root . '/storage/logs';
$logs = glob($logDir . '/laravel*.log') ?: [];
if ($logs !== []) {
    usort($logs, fn ($a, $b) => filemtime($b) <=> filemtime($a));
    $lines = @file($logs[0], FILE_IGNORE_NEW_LINES);
    if ($lines !== false && count($lines) > 0) {
        echo "\n--- Últimas 15 líneas de " . basename($logs[0]) . " ---\n";
        echo implode("\n", array_slice($lines, -15)) . "\n";
    }
}

echo "\n=== Fin. Borra diag.php cuando termines. ===\n";

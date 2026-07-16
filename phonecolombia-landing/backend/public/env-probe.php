<?php
/**
 * Diagnóstico del .env — Laravel revienta en LoadEnvironmentVariables.
 * Abre: https://api.phonecolombia.com/env-probe.php
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

out("=== Env probe ===\n\n");

out("--- APP_ENV en el servidor (ANTES de cargar .env) ---\n");
$preEnv = getenv('APP_ENV') ?: ($_SERVER['APP_ENV'] ?? $_ENV['APP_ENV'] ?? null);
out('getenv(APP_ENV): ' . ($preEnv !== false && $preEnv !== null && $preEnv !== '' ? $preEnv : '(no definido)') . "\n");
if ($preEnv === 'production' || $preEnv === 'local' || $preEnv === 'staging') {
    out(">>> AVISO: Hostinger tiene APP_ENV=$preEnv en el sistema.\n");
    out("    Laravel intentará cargar .env.$preEnv en lugar de .env\n");
}

out("\n--- Archivos de entorno en backend/ ---\n");
$candidates = ['.env', '.env.production', '.env.local', '.env.example', 'env.production'];
foreach ($candidates as $name) {
    $path = $root . '/' . $name;
    out(sprintf("  %-18s %s\n", $name . ':', file_exists($path) ? 'EXISTE (' . filesize($path) . ' bytes)' : 'no'));
}

$envPath = $root . '/.env';
if (!file_exists($envPath)) {
    out("\nERROR: no hay .env en $root\n");
    exit;
}

out("\n--- Primeras líneas de .env (sin contraseña) ---\n");
$lines = file($envPath, FILE_IGNORE_NEW_LINES);
foreach (array_slice($lines, 0, 15) as $i => $line) {
    $n = $i + 1;
    if (str_contains($line, 'PASSWORD')) {
        out("  $n: DB_PASSWORD=***\n");
    } else {
        out("  $n: $line\n");
    }
}
out('  ... total ' . count($lines) . " líneas\n");

out("\n--- Validación línea a línea ---\n");
$issues = [];
foreach ($lines as $i => $line) {
    $n = $i + 1;
    $trim = trim($line);
    if ($trim === '' || str_starts_with($trim, '#')) {
        continue;
    }
    if (!str_contains($trim, '=')) {
        $issues[] = "Línea $n sin '=': $trim";
        continue;
    }
    [$key, $value] = explode('=', $trim, 2);
    $key = trim($key);
    $value = trim($value);
    if ($key === 'DB_PASSWORD' && $value !== '' && !str_starts_with($value, '"') && !str_starts_with($value, "'")) {
        if (preg_match('/[^A-Za-z0-9_.@:-]/', $value)) {
            $issues[] = "Línea $n: DB_PASSWORD tiene símbolos (*, #, etc.) SIN comillas";
        }
    }
    if (str_contains($value, ' ') && !str_starts_with($value, '"') && !str_starts_with($value, "'")) {
        $issues[] = "Línea $n: valor con espacios sin comillas ($key)";
    }
}
if ($issues === []) {
    out("  Sin problemas obvios de sintaxis.\n");
} else {
    foreach ($issues as $issue) {
        out("  !!! $issue\n");
    }
}

out("\n--- Dotenv safeLoad en .env ---\n");
try {
    $repo = Illuminate\Support\Env::getRepository();
    $dotenv = Dotenv\Dotenv::create($repo, $root, '.env');
    $dotenv->safeLoad();
    out("  .env: OK\n");
    $pass = Illuminate\Support\Env::get('DB_PASSWORD');
    out('  DB_PASSWORD cargada: ' . ($pass !== null && $pass !== '' ? strlen((string) $pass) . ' chars' : 'NO DEFINIDA') . "\n");
} catch (Dotenv\Exception\InvalidFileException $e) {
    out("  .env: INVÁLIDO\n");
    out('  ' . $e->getMessage() . "\n");
} catch (Throwable $e) {
    out("  .env: ERROR\n");
    out('  ' . $e->getMessage() . "\n");
}

$prodPath = $root . '/.env.production';
if (file_exists($prodPath)) {
    out("\n--- Dotenv safeLoad en .env.production ---\n");
    try {
        $repo2 = Dotenv\Repository\RepositoryBuilder::createWithDefaultAdapters()->make();
        $dotenv2 = Dotenv\Dotenv::create($repo2, $root, '.env.production');
        $dotenv2->safeLoad();
        out("  .env.production: OK (archivo parseable)\n");
        out("  >>> Si APP_ENV=production en el servidor, Laravel usa ESTE archivo.\n");
        out("  >>> Borra .env.production o renómbralo si tu config real está en .env\n");
    } catch (Dotenv\Exception\InvalidFileException $e) {
        out("  .env.production: INVÁLIDO — ESTO CAUSA EL HTTP 500\n");
        out('  ' . $e->getMessage() . "\n");
    }
}

out("\n--- Qué archivo usaría Laravel ---\n");
$app = require $root . '/bootstrap/app.php';
$target = $app->environmentFile();
if ($preEnv !== false && $preEnv !== null && $preEnv !== '' && file_exists($root . '/.env.' . $preEnv)) {
    $target = '.env.' . $preEnv;
}
out("  Archivo efectivo: $target\n");

out("\n=== Fin. Borra env-probe.php del servidor. ===\n");

<?php
/**
 * Muestra las últimas líneas de storage/logs/laravel.log
 * Abre: https://api.phonecolombia.com/show-log.php
 * BORRA este archivo cuando termines.
 */
header('Content-Type: text/plain; charset=utf-8');

$root = dirname(__DIR__);
$logDir = $root . '/storage/logs';
$lines = max(20, min(300, (int) ($_GET['lines'] ?? 80)));

echo "=== Laravel log (últimas $lines líneas) ===\n\n";

if (!is_dir($logDir)) {
    echo "No existe storage/logs\n";
    exit;
}

$candidates = glob($logDir . '/laravel*.log') ?: [];
if ($candidates === []) {
    echo "No hay archivos laravel*.log en storage/logs\n";
    echo "(Si la API falla antes de escribir logs, usa error-capture.php)\n";
    exit;
}

usort($candidates, fn ($a, $b) => filemtime($b) <=> filemtime($a));
$logFile = $candidates[0];

echo 'Archivo: ' . basename($logFile) . "\n";
echo 'Tamaño: ' . filesize($logFile) . " bytes\n";
echo 'Modificado: ' . date('c', filemtime($logFile)) . "\n\n";
echo str_repeat('-', 60) . "\n\n";

$all = file($logFile, FILE_IGNORE_NEW_LINES);
if ($all === false) {
    echo "No se pudo leer el archivo.\n";
    exit;
}

$tail = array_slice($all, -$lines);
echo implode("\n", $tail) . "\n\n";
echo "=== Fin. Borra show-log.php del servidor. ===\n";

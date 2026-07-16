<?php
/**
 * Escribe caché de bootstrap de PRODUCCIÓN (sin Pail/Sail/Collision).
 * Sube también la carpeta deploy/production-bootstrap-cache/ junto a este archivo.
 *
 * 1) Sube public/fix-production-cache.php
 * 2) Sube deploy/production-bootstrap-cache/packages.php y services.php
 *    a public/production-bootstrap-cache/ (misma carpeta que este script)
 * 3) Abre https://api.phonecolombia.com/fix-production-cache.php
 * 4) BORRA este archivo y la carpeta production-bootstrap-cache/
 */
header('Content-Type: text/plain; charset=utf-8');

$root = dirname(__DIR__);
$cacheDir = $root . '/bootstrap/cache';
$srcDir = __DIR__ . '/production-bootstrap-cache';

echo "=== Instalar caché de producción ===\n\n";

if (!is_dir($cacheDir)) {
    echo "ERROR: no existe $cacheDir\n";
    exit;
}

if (!is_writable($cacheDir)) {
    echo "ERROR: bootstrap/cache no es escribible (usa permisos 755).\n";
    exit;
}

$files = ['packages.php', 'services.php'];
$ok = true;

foreach ($files as $file) {
    $src = $srcDir . '/' . $file;
    $dst = $cacheDir . '/' . $file;

    if (!file_exists($src)) {
        echo "$file: FALTA en production-bootstrap-cache/ — súbela junto a este script.\n";
        $ok = false;
        continue;
    }

    $content = file_get_contents($src);
    if ($content === false || $content === '') {
        echo "$file: archivo vacío o ilegible.\n";
        $ok = false;
        continue;
    }

    foreach (['Pail', 'Sail', 'Collision'] as $devPkg) {
        if (str_contains($content, $devPkg)) {
            echo "$file: AVISO contiene $devPkg — no es caché de producción.\n";
        }
    }

    if (file_put_contents($dst, $content) === false) {
        echo "$file: no se pudo escribir en bootstrap/cache.\n";
        $ok = false;
        continue;
    }

    echo "$file: INSTALADO en bootstrap/cache/\n";
}

if (!$ok) {
    echo "\nCorrige los errores y vuelve a abrir esta URL.\n";
    exit;
}

echo "\nListo. Prueba:\n";
echo "https://api.phonecolombia.com/api/products\n\n";
echo "BORRA fix-production-cache.php y production-bootstrap-cache/ del servidor.\n";

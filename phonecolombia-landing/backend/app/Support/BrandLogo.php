<?php

namespace App\Support;

class BrandLogo
{
    public static function remissionDataUri(): ?string
    {
        foreach (self::candidatePaths() as $path) {
            $resolved = realpath($path);
            if ($resolved && is_readable($resolved)) {
                $mime = match (strtolower(pathinfo($resolved, PATHINFO_EXTENSION))) {
                    'png' => 'image/png',
                    'gif' => 'image/gif',
                    'webp' => 'image/webp',
                    default => 'image/jpeg',
                };

                return 'data:'.$mime.';base64,'.base64_encode((string) file_get_contents($resolved));
            }
        }

        return null;
    }

    /** @return list<string> */
    private static function candidatePaths(): array
    {
        return [
            base_path('../public/imagenes/logo-blanco-rojo.jfif'),
            public_path('imagenes/logo-blanco-rojo.jfif'),
            resource_path('images/logo-blanco-rojo.jfif'),
        ];
    }
}

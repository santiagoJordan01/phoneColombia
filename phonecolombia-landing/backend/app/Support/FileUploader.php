<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileUploader
{
    public static function collectFiles(Request $request, string $key): array
    {
        $files = $request->file($key);

        if (! $files) {
            return [];
        }

        if ($files instanceof UploadedFile) {
            return [$files];
        }

        return array_values(array_filter($files, fn ($file) => $file instanceof UploadedFile));
    }

    public static function upload(UploadedFile $file, string $folder): string
    {
        $safeName = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME), '_');
        $extension = $file->getClientOriginalExtension();
        $filename = time().'_'.($safeName ?: 'file').($extension ? '.'.$extension : '');

        $path = $file->storeAs($folder, $filename, 'public');

        return Storage::disk('public')->url($path);
    }

    public static function uploadMany(array $files, string $folder): array
    {
        $urls = [];

        foreach ($files as $file) {
            if ($file instanceof UploadedFile) {
                $urls[] = self::upload($file, $folder);
            }
        }

        return $urls;
    }

    public static function deleteByUrl(?string $url): void
    {
        if (! $url) {
            return;
        }

        $path = parse_url($url, PHP_URL_PATH);
        if (! $path) {
            return;
        }

        $relative = ltrim(Str::after($path, '/storage/'), '/');
        if ($relative && Storage::disk('public')->exists($relative)) {
            Storage::disk('public')->delete($relative);
        }
    }
}

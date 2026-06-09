<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use App\Support\FileUploader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SiteSettingController extends Controller
{
    public function show(string $key): JsonResponse
    {
        $setting = SiteSetting::find($key);

        if (! $setting) {
            return response()->json(['key' => $key, 'value' => null]);
        }

        return response()->json([
            'key' => $setting->key,
            'value' => $setting->value,
        ]);
    }

    public function upsert(Request $request, string $key): JsonResponse
    {
        if ($key === 'hero_video_url' && $request->hasFile('video')) {
            $request->validate([
                'video' => ['required', 'file', 'mimetypes:video/mp4,video/quicktime,video/webm', 'max:51200'],
            ]);

            $existing = SiteSetting::find($key);
            if ($existing?->value) {
                FileUploader::deleteByUrl($existing->value);
            }

            $videoUrl = FileUploader::upload($request->file('video'), 'hero');

            $setting = SiteSetting::updateOrCreate(
                ['key' => $key],
                ['value' => $videoUrl, 'updated_at' => now()]
            );

            return response()->json([
                'key' => $setting->key,
                'value' => $setting->value,
            ]);
        }

        $data = $request->validate([
            'value' => ['required'],
        ]);

        $value = is_array($data['value']) || is_object($data['value'])
            ? json_encode($data['value'])
            : (string) $data['value'];

        $setting = SiteSetting::updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'updated_at' => now()]
        );

        return response()->json([
            'key' => $setting->key,
            'value' => $setting->value,
        ]);
    }
}

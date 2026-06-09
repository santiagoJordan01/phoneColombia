<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Testimonio;
use App\Support\FileUploader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TestimonioController extends Controller
{
    public function index(): JsonResponse
    {
        $testimonios = Testimonio::query()
            ->orderByDesc('created_at')
            ->get();

        return response()->json($testimonios);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'caption' => ['nullable', 'string', 'max:500'],
            'video' => ['required', 'file', 'mimetypes:video/mp4,video/quicktime,video/webm', 'max:51200'],
        ]);

        $videoUrl = FileUploader::upload($request->file('video'), 'testimonios/videos');

        $testimonio = Testimonio::create([
            'caption' => $data['caption'] ?? null,
            'video_url' => $videoUrl,
        ]);

        return response()->json($testimonio, 201);
    }

    public function update(Request $request, Testimonio $testimonio): JsonResponse
    {
        $data = $request->validate([
            'caption' => ['nullable', 'string', 'max:500'],
            'video' => ['nullable', 'file', 'mimetypes:video/mp4,video/quicktime,video/webm', 'max:51200'],
        ]);

        $updateData = [];

        if (array_key_exists('caption', $data)) {
            $updateData['caption'] = $data['caption'];
        }

        if ($request->hasFile('video')) {
            FileUploader::deleteByUrl($testimonio->video_url);
            $updateData['video_url'] = FileUploader::upload($request->file('video'), 'testimonios/videos');
        }

        $testimonio->update($updateData);

        return response()->json($testimonio->fresh());
    }

    public function destroy(Testimonio $testimonio): JsonResponse
    {
        FileUploader::deleteByUrl($testimonio->video_url);
        $testimonio->delete();

        return response()->json(['message' => 'Testimonio eliminado']);
    }
}

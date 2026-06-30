<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditPaymentMethod;
use App\Models\CreditSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CreditConfigController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales() && ! $user->isSuperAdmin()) {
            return response()->json(['message' => 'Acceso no autorizado.'], 403);
        }

        return response()->json([
            'methods' => CreditPaymentMethod::query()
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'settings' => CreditSetting::current(),
        ]);
    }

    public function storeMethod(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'slug' => ['nullable', 'string', 'max:80', 'unique:credit_payment_methods,slug'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $slug = $data['slug'] ?? Str::slug($data['name'], '_');
        $slug = $this->uniqueSlug($slug);

        $method = CreditPaymentMethod::create([
            'name' => trim($data['name']),
            'slug' => $slug,
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? ((int) CreditPaymentMethod::max('sort_order')) + 1,
        ]);

        return response()->json($method, 201);
    }

    public function updateMethod(Request $request, CreditPaymentMethod $creditPaymentMethod): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'slug' => ['sometimes', 'string', 'max:80', Rule::unique('credit_payment_methods', 'slug')->ignore($creditPaymentMethod->id)],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        if (array_key_exists('name', $data)) {
            $creditPaymentMethod->name = trim($data['name']);
        }
        if (array_key_exists('slug', $data)) {
            $creditPaymentMethod->slug = trim($data['slug']);
        }
        if (array_key_exists('is_active', $data)) {
            $creditPaymentMethod->is_active = (bool) $data['is_active'];
        }
        if (array_key_exists('sort_order', $data)) {
            $creditPaymentMethod->sort_order = (int) $data['sort_order'];
        }

        $creditPaymentMethod->save();

        return response()->json($creditPaymentMethod);
    }

    public function destroyMethod(Request $request, CreditPaymentMethod $creditPaymentMethod): JsonResponse
    {
        $this->authorizeAdmin($request);

        if ($creditPaymentMethod->sales()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar: hay ventas asociadas a este medio de crédito.',
            ], 422);
        }

        $creditPaymentMethod->delete();

        return response()->json(['message' => 'Medio de crédito eliminado']);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'billing_day' => ['required', 'integer', 'min:1', 'max:28'],
        ]);

        $settings = CreditSetting::current();
        $settings->billing_day = (int) $data['billing_day'];
        $settings->save();

        return response()->json($settings);
    }

    private function authorizeAdmin(Request $request): void
    {
        if (! $request->user()->isSuperAdmin()) {
            abort(403, 'Solo el administrador principal puede modificar la configuración de crédito.');
        }
    }

    private function uniqueSlug(string $slug): string
    {
        $base = $slug ?: 'medio';
        $candidate = $base;
        $i = 2;
        while (CreditPaymentMethod::query()->where('slug', $candidate)->exists()) {
            $candidate = $base.'_'.$i;
            $i++;
        }

        return $candidate;
    }
}

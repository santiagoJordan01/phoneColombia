<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\DeniesReadOnlyInventoryRoles;
use App\Http\Controllers\Controller;
use App\Models\ServiceCategory;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ServiceCategoryController extends Controller
{
    use DeniesReadOnlyInventoryRoles;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $query = ServiceCategory::query()->orderBy('sort_order')->orderBy('name');

        if ($request->boolean('active_only', false)) {
            $query->where('is_active', true);
        }

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)->orWhere('slug', 'like', $term);
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:60', 'alpha_dash', Rule::unique('service_categories', 'slug')],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $slug = $data['slug'] ?? Str::slug($data['name'], '_');

        $category = ServiceCategory::create([
            'name' => trim($data['name']),
            'slug' => $slug,
            'description' => $data['description'] ?? null,
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);

        $this->audit->log($category, 'created', 'name', null, $category->name);

        return response()->json($category, 201);
    }

    public function update(Request $request, ServiceCategory $serviceCategory): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:60', 'alpha_dash', Rule::unique('service_categories', 'slug')->ignore($serviceCategory->id)],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (isset($data['name'])) {
            $data['name'] = trim($data['name']);
        }

        $original = $serviceCategory->getAttributes();
        $serviceCategory->update($data);

        $changes = $serviceCategory->getChanges();
        unset($changes['updated_at']);
        $this->audit->logChanges($serviceCategory, $original, $changes);

        return response()->json($serviceCategory->fresh());
    }

    public function destroy(Request $request, ServiceCategory $serviceCategory): JsonResponse
    {
        $this->denyIfCannotManageCatalog($request->user());
        $this->audit->log($serviceCategory, 'deleted', 'name', $serviceCategory->name, null);
        $serviceCategory->delete();

        return response()->json(['message' => 'Categoría eliminada']);
    }
}

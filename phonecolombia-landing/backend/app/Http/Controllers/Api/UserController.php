<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(): JsonResponse
    {
        $users = User::query()
            ->where(function ($query) {
                $query->whereNotNull('role')->orWhere('is_admin', true);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'is_admin', 'supplier_id', 'service_technician_id', 'created_at']);

        return response()->json($users->map(fn (User $user) => $this->serializeUser($user)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', Rule::in(User::ROLES)],
            'supplier_id' => ['nullable', 'uuid', 'exists:suppliers,id', 'required_if:role,'.User::ROLE_SUPPLIER],
            'service_technician_id' => ['nullable', 'uuid', 'exists:service_technicians,id', 'required_if:role,'.User::ROLE_SERVICE_TECHNICIAN],
        ]);

        $user = User::create([
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'password' => $data['password'],
            'role' => $data['role'],
            'supplier_id' => $data['role'] === User::ROLE_SUPPLIER ? ($data['supplier_id'] ?? null) : null,
            'service_technician_id' => $data['role'] === User::ROLE_SERVICE_TECHNICIAN ? ($data['service_technician_id'] ?? null) : null,
            'is_admin' => $data['role'] === User::ROLE_SUPER_ADMIN,
        ]);

        $this->audit->log($user, 'created');

        return response()->json($this->serializeUser($user), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'role' => ['sometimes', 'required', Rule::in(User::ROLES)],
            'supplier_id' => ['nullable', 'uuid', 'exists:suppliers,id'],
            'service_technician_id' => ['nullable', 'uuid', 'exists:service_technicians,id'],
        ]);

        $original = $user->getOriginal();

        if (array_key_exists('name', $data)) {
            $user->name = trim($data['name']);
        }

        if (array_key_exists('email', $data)) {
            $user->email = strtolower(trim($data['email']));
        }

        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }

        if (array_key_exists('role', $data)) {
            if ($request->user()->id === $user->id && $data['role'] !== User::ROLE_SUPER_ADMIN) {
                return response()->json([
                    'message' => 'No puedes cambiar tu propio rol de administrador principal.',
                ], 422);
            }

            $user->role = $data['role'];
            $user->is_admin = $data['role'] === User::ROLE_SUPER_ADMIN;
            $user->supplier_id = $data['role'] === User::ROLE_SUPPLIER
                ? ($data['supplier_id'] ?? $user->supplier_id)
                : null;
            $user->service_technician_id = $data['role'] === User::ROLE_SERVICE_TECHNICIAN
                ? ($data['service_technician_id'] ?? $user->service_technician_id)
                : null;
        } elseif (array_key_exists('supplier_id', $data) && $user->role === User::ROLE_SUPPLIER) {
            $user->supplier_id = $data['supplier_id'];
        } elseif (array_key_exists('service_technician_id', $data) && $user->role === User::ROLE_SERVICE_TECHNICIAN) {
            $user->service_technician_id = $data['service_technician_id'];
        }

        $user->save();

        $changes = $user->getChanges();
        unset($changes['updated_at'], $changes['password']);
        $this->audit->logChanges($user, $original, $changes);

        return response()->json($this->serializeUser($user->fresh()));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'No puedes eliminar tu propia cuenta.'], 422);
        }

        $this->audit->log($user, 'deleted', null, $user->email, null, [
            'name' => $user->name,
            'role' => $user->resolvedRole(),
        ]);

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Usuario eliminado']);
    }

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->resolvedRole(),
            'is_admin' => $user->is_admin,
            'supplier_id' => $user->supplier_id,
            'service_technician_id' => $user->service_technician_id,
            'created_at' => $user->created_at,
        ];
    }
}

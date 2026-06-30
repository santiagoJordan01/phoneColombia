<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditPaymentMethod;
use App\Models\CreditSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BootstrapController extends Controller
{
    public function __construct(
        private InventoryItemController $inventoryItems,
        private DashboardController $dashboard,
        private SaleController $sales,
        private ServiceTicketController $serviceTickets,
        private SupplierController $suppliers,
        private UserController $users,
        private ReportController $reports,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canAccessInventory() && ! $user->canManageSales()) {
            return response()->json(['message' => 'Acceso no autorizado.'], 403);
        }

        return response()->json([
            'user' => $this->userPayload($user),
            'dashboard' => $this->dashboard->index($request)->getData(true),
        ]);
    }

    public function inventory(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canAccessInventory()) {
            return response()->json(['message' => 'Acceso no autorizado.'], 403);
        }

        return response()->json([
            'user' => $this->userPayload($user),
            'items' => $this->inventoryItems->index($request)->getData(true),
        ]);
    }

    public function sales(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales() && ! $user->isSuperAdmin()) {
            return response()->json(['message' => 'No tienes permiso para ver ventas.'], 403);
        }

        $itemsRequest = Request::create(
            $request->url(),
            'GET',
            array_merge($request->query(), ['sale_eligible' => true]),
        );
        $itemsRequest->setUserResolver($request->getUserResolver());

        return response()->json([
            'user' => $this->userPayload($user),
            'sales' => $this->sales->index($request)->getData(true),
            'available_items' => $this->inventoryItems->index($itemsRequest)->getData(true),
            'credit_config' => [
                'methods' => CreditPaymentMethod::query()
                    ->where('is_active', true)
                    ->orderBy('sort_order')
                    ->orderBy('name')
                    ->get(['id', 'name', 'slug']),
                'settings' => CreditSetting::current(),
            ],
        ]);
    }

    public function serviceTickets(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canAccessServiceTickets()) {
            return response()->json(['message' => 'Acceso no autorizado.'], 403);
        }

        return response()->json([
            'user' => $this->userPayload($user),
            'meta' => $this->serviceTickets->workshops()->getData(true),
            'tickets' => $this->serviceTickets->index($request)->getData(true),
        ]);
    }

    public function reports(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canViewReports() && ! $user->isSuperAdmin()) {
            return response()->json(['message' => 'Acceso no autorizado.'], 403);
        }

        $payload = [
            'user' => $this->userPayload($user),
        ];

        if ($user->canViewReports()) {
            $payload['suppliers'] = $this->suppliers->index()->getData(true);
            $payload['filter_users'] = User::query()
                ->whereIn('role', [
                    User::ROLE_SUPER_ADMIN,
                    User::ROLE_INVENTORY,
                    User::ROLE_SELLER,
                    User::ROLE_ASESOR,
                ])
                ->orderBy('name')
                ->get(['id', 'name', 'role'])
                ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'role' => $u->resolvedRole()])
                ->values()
                ->all();
        }

        $tab = $request->string('tab', 'daily')->toString();
        if ($tab === 'daily') {
            $payload['daily'] = $this->reports->daily($request)->getData(true);
        } elseif ($tab === 'monthly') {
            $payload['monthly'] = $this->reports->monthly($request)->getData(true);
        } elseif ($tab === 'cash') {
            $payload['cash'] = $this->reports->cashRegister($request)->getData(true);
        }

        return response()->json($payload);
    }

    private function userPayload(?User $user): array
    {
        if (! $user) {
            return [];
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->resolvedRole(),
            'is_admin' => $user->is_admin,
            'supplier_id' => $user->supplier_id,
            'service_technician_id' => $user->service_technician_id,
        ];
    }
}

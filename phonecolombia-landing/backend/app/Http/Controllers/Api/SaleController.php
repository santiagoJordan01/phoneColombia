<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\ServiceCustomer;
use App\Services\AuditService;
use App\Services\InventoryMovementService;
use App\Support\InventoryStatus;
use App\Support\InventoryStatusGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SaleController extends Controller
{
    use ScopesInventoryForUser;

    public function __construct(
        private InventoryMovementService $movements,
        private AuditService $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales() && ! $user->isSuperAdmin()) {
            return response()->json(['message' => 'No tienes permiso para ver ventas.'], 403);
        }

        $query = Sale::query()
            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer'])
            ->orderByDesc('sold_at');

        if ($request->filled('from')) {
            $query->whereDate('sold_at', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('sold_at', '<=', $request->date('to'));
        }
        if ($request->filled('credit_status')) {
            $query->where('credit_status', $request->string('credit_status'));
        }
        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->string('payment_method'));
        }

        if ($user->isSupplier() && $user->supplier_id) {
            $query->whereHas('inventoryItem', fn ($q) => $q->where('supplier_id', $user->supplier_id));
        }

        return response()->json($query->get()->map(fn (Sale $sale) => $this->serializeSale($sale)));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales()) {
            return response()->json(['message' => 'No tienes permiso para registrar ventas.'], 403);
        }

        $data = $request->validate([
            'inventory_item_id' => ['required', 'uuid', 'exists:inventory_items,id'],
            'sale_price' => ['required', 'string', 'max:50'],
            'payment_method' => ['required', Rule::in(['efectivo', 'transferencia', 'credito', 'mixto'])],
            'customer_name' => ['nullable', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'service_customer_id' => ['nullable', 'uuid', 'exists:service_customers,id'],
            'notes' => ['nullable', 'string'],
            'sold_at' => ['nullable', 'date'],
            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['required_with:payments', Rule::in(['efectivo', 'transferencia', 'credito'])],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'min:0'],
            'payments.*.notes' => ['nullable', 'string'],
        ]);

        $item = InventoryItem::findOrFail($data['inventory_item_id']);
        $this->authorizeItemForUser($request, $item);

        InventoryStatusGuard::assertAvailableForSale($item);

        $salePrice = $this->parseAmount($data['sale_price']);

        if ($data['payment_method'] === 'mixto') {
            if (empty($data['payments']) || count($data['payments']) < 2) {
                return response()->json([
                    'message' => 'El pago mixto requiere al menos dos líneas de pago.',
                    'errors' => ['payments' => ['Indica al menos dos pagos para venta mixta.']],
                ], 422);
            }
            $payments = $data['payments'];
        } else {
            $payments = $data['payments'] ?? $this->defaultPayments($data['payment_method'], $salePrice);
        }

        $amountPaid = collect($payments)->sum('amount');
        if ($amountPaid > $salePrice) {
            return response()->json([
                'message' => 'El total pagado no puede superar el precio de venta.',
            ], 422);
        }
        $amountDue = max(0, $salePrice - $amountPaid);
        $creditStatus = $amountDue > 0 ? 'pending' : 'paid';

        if (! empty($data['service_customer_id'])) {
            $customer = ServiceCustomer::find($data['service_customer_id']);
            if ($customer) {
                $data['customer_name'] = $customer->name;
                $data['customer_phone'] = $customer->phone;
            }
        }

        $sale = DB::transaction(function () use ($data, $item, $user, $payments, $amountPaid, $amountDue, $creditStatus) {
            $oldStatus = $item->status;
            $item->update(['status' => InventoryStatus::VENDIDO]);

            $sale = Sale::create([
                'inventory_item_id' => $item->id,
                'user_id' => $user->id,
                'service_customer_id' => $data['service_customer_id'] ?? null,
                'sale_price' => $data['sale_price'],
                'payment_method' => $data['payment_method'],
                'credit_status' => $creditStatus,
                'amount_paid' => $amountPaid,
                'amount_due' => $amountDue,
                'customer_name' => $data['customer_name'] ?? null,
                'customer_phone' => $data['customer_phone'] ?? null,
                'notes' => $data['notes'] ?? null,
                'sold_at' => $data['sold_at'] ?? now(),
            ]);

            foreach ($payments as $payment) {
                if ((float) $payment['amount'] <= 0) {
                    continue;
                }
                SalePayment::create([
                    'sale_id' => $sale->id,
                    'user_id' => $user->id,
                    'method' => $payment['method'],
                    'amount' => $payment['amount'],
                    'notes' => $payment['notes'] ?? null,
                    'paid_at' => $data['sold_at'] ?? now(),
                ]);
            }

            $this->movements->record($item, 'venta', 'status', $oldStatus, InventoryStatus::VENDIDO, 'Venta registrada', [
                'sale_id' => $sale->id,
                'sale_price' => $data['sale_price'],
            ]);
            $this->audit->log($sale, 'created');

            return $sale;
        });

        return response()->json($this->serializeSale($sale->load(['inventoryItem', 'user', 'payments'])), 201);
    }

    public function addPayment(Request $request, Sale $sale): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales()) {
            return response()->json(['message' => 'No tienes permiso.'], 403);
        }

        $data = $request->validate([
            'method' => ['required', Rule::in(['efectivo', 'transferencia', 'credito'])],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string'],
            'paid_at' => ['nullable', 'date'],
        ]);

        if ($sale->credit_status === 'paid') {
            return response()->json(['message' => 'Esta venta ya está pagada en su totalidad.'], 422);
        }

        DB::transaction(function () use ($sale, $data, $user) {
            SalePayment::create([
                'sale_id' => $sale->id,
                'user_id' => $user->id,
                'method' => $data['method'],
                'amount' => $data['amount'],
                'notes' => $data['notes'] ?? null,
                'paid_at' => $data['paid_at'] ?? now(),
            ]);

            $sale->amount_paid = $sale->payments()->sum('amount');
            $sale->amount_due = max(0, $this->parseAmount($sale->sale_price) - $sale->amount_paid);
            $sale->credit_status = $sale->amount_due > 0 ? 'pending' : 'paid';
            $sale->save();
            $this->audit->log($sale, 'payment_added', 'amount_paid', null, $sale->amount_paid);
        });

        return response()->json($this->serializeSale($sale->fresh()->load(['inventoryItem', 'user', 'payments'])));
    }

    private function authorizeItemForUser(Request $request, InventoryItem $item): void
    {
        $user = $request->user();
        if ($user->isSupplier() && $user->supplier_id && $item->supplier_id !== $user->supplier_id) {
            abort(403, 'No tienes acceso a este equipo.');
        }
    }

    private function defaultPayments(string $method, float $amount): array
    {
        if ($method === 'mixto' || $method === 'credito') {
            return [];
        }

        return [['method' => $method, 'amount' => $amount]];
    }

    private function parseAmount(string $value): float
    {
        return (float) preg_replace('/[^\d.]/', '', $value);
    }

    private function serializeSale(Sale $sale): array
    {
        return [
            'id' => $sale->id,
            'inventory_item_id' => $sale->inventory_item_id,
            'inventory_item' => $sale->inventoryItem,
            'user' => $sale->user ? ['id' => $sale->user->id, 'name' => $sale->user->name] : null,
            'sale_price' => $sale->sale_price,
            'payment_method' => $sale->payment_method,
            'credit_status' => $sale->credit_status,
            'amount_paid' => $sale->amount_paid,
            'amount_due' => $sale->amount_due,
            'customer_name' => $sale->customer_name,
            'customer_phone' => $sale->customer_phone,
            'service_customer_id' => $sale->service_customer_id,
            'service_customer' => $sale->serviceCustomer ? [
                'id' => $sale->serviceCustomer->id,
                'name' => $sale->serviceCustomer->name,
                'phone' => $sale->serviceCustomer->phone,
            ] : null,
            'notes' => $sale->notes,
            'sold_at' => $sale->sold_at,
            'payments' => $sale->payments,
            'created_at' => $sale->created_at,
        ];
    }
}

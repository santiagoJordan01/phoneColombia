<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ScopesInventoryForUser;
use App\Http\Controllers\Controller;
use App\Models\CreditPaymentMethod;
use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\ServiceCustomer;
use App\Services\AuditService;
use App\Services\InventoryMovementService;
use App\Support\CreditTermCalculator;
use App\Support\InventoryFieldGuard;
use App\Support\InventoryStatus;
use App\Support\InventoryStatusGuard;
use App\Support\MoneyFormatter;
use App\Support\PaymentMethods;
use App\Support\RemissionNumberGenerator;
use App\Support\SaleReservationStatus;
use App\Support\ServiceCustomerResolver;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SaleReservationController extends Controller
{
    use ScopesInventoryForUser;

    public function __construct(
        private InventoryMovementService $movements,
        private AuditService $audit,
    ) {}

    public function reserve(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $user = $request->user();
        $this->authorizeItemForUser($request, $inventoryItem);
        $this->assertCanManageReservation($user);

        if ($inventoryItem->status !== InventoryStatus::DISPONIBLE) {
            throw ValidationException::withMessages([
                'status' => ['Solo equipos disponibles pueden apartarse con abono.'],
            ]);
        }

        if (self::activeReservationForItem($inventoryItem->id)) {
            return response()->json(['message' => 'Este equipo ya tiene un apartado activo.'], 422);
        }

        $data = $request->validate([
            'sale_price' => ['required', 'string', 'max:50'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'deposit_method' => ['nullable', Rule::in(PaymentMethods::immediate())],
            'customer_name' => ['nullable', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'service_customer_id' => ['nullable', 'uuid', 'exists:service_customers,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $salePrice = MoneyFormatter::parse($data['sale_price']);
        $deposit = round((float) ($data['deposit_amount'] ?? 0), 2);

        if ($deposit > $salePrice) {
            throw ValidationException::withMessages([
                'deposit_amount' => ['El abono no puede superar el precio acordado.'],
            ]);
        }

        if ($deposit > 0 && empty($data['deposit_method'])) {
            throw ValidationException::withMessages([
                'deposit_method' => ['Indica el método de pago del abono.'],
            ]);
        }

        ServiceCustomerResolver::resolveIntoPayload($data);

        $reservedAt = now();
        $depositMethod = $deposit > 0 ? ($data['deposit_method'] ?? 'efectivo') : 'efectivo';
        $amountDue = max(0, $salePrice - $deposit);
        $creditStatus = $amountDue > 0 ? 'pending' : 'paid';

        $sale = DB::transaction(function () use ($inventoryItem, $user, $data, $deposit, $depositMethod, $amountDue, $creditStatus, $reservedAt) {
            $oldStatus = $inventoryItem->status;

            $inventoryItem->update([
                'status' => InventoryStatus::SEPARADO,
                'sale_price' => $data['sale_price'],
                'notes' => $data['notes'] ?? $inventoryItem->notes,
            ]);

            $sale = Sale::create([
                'remission_number' => RemissionNumberGenerator::next(),
                'inventory_item_id' => $inventoryItem->id,
                'user_id' => $user->id,
                'service_customer_id' => $data['service_customer_id'] ?? null,
                'sale_price' => $data['sale_price'],
                'payment_method' => $depositMethod,
                'credit_status' => $creditStatus,
                'amount_paid' => $deposit,
                'amount_due' => $amountDue,
                'customer_name' => $data['customer_name'] ?? null,
                'customer_phone' => $data['customer_phone'] ?? null,
                'notes' => $data['notes'] ?? null,
                'reserved_at' => $reservedAt,
                'reservation_status' => SaleReservationStatus::ACTIVE,
                'sold_at' => null,
            ]);

            if ($deposit > 0) {
                SalePayment::create([
                    'sale_id' => $sale->id,
                    'user_id' => $user->id,
                    'method' => $depositMethod,
                    'amount' => $deposit,
                    'notes' => 'Abono inicial apartado',
                    'paid_at' => $reservedAt,
                ]);
            }

            $this->movements->record($inventoryItem, 'status_change', 'status', $oldStatus, InventoryStatus::SEPARADO, 'Equipo apartado', [
                'sale_id' => $sale->id,
                'remission_number' => $sale->remission_number,
                'sale_price' => $data['sale_price'],
                'deposit' => $deposit,
            ]);

            $this->audit->log($sale, 'reservation_created');
            $this->audit->log($inventoryItem, 'updated', 'status', $oldStatus, InventoryStatus::SEPARADO, [
                'reservation_sale_id' => $sale->id,
            ]);

            return $sale;
        });

        $itemPayload = app(InventoryItemController::class)
            ->serializeItemPublic($inventoryItem->fresh()->load(['inventoryProduct', 'supplierRelation', 'activeReservation.payments']), $user);

        return response()->json([
            'item' => $itemPayload,
            'reservation' => $this->serializeSale($sale->load(['inventoryItem', 'user', 'payments', 'serviceCustomer'])),
        ], 201);
    }

    public function cancelByItem(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $user = $request->user();
        $this->authorizeItemForUser($request, $inventoryItem);
        $this->assertCanManageReservation($user);

        $sale = self::activeReservationForItem($inventoryItem->id);
        if (! $sale) {
            return response()->json(['message' => 'No hay apartado activo para este equipo.'], 422);
        }

        $this->cancelReservationSale($inventoryItem, $sale);

        return response()->json(
            app(InventoryItemController::class)->serializeItemPublic(
                $inventoryItem->fresh()->load(['inventoryProduct', 'supplierRelation']),
                $user
            )
        );
    }

    public function cancel(Request $request, Sale $sale): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales()) {
            return response()->json(['message' => 'No tienes permiso.'], 403);
        }

        if (! $sale->isActiveReservation()) {
            return response()->json(['message' => 'Esta venta no es un apartado activo.'], 422);
        }

        $item = $sale->inventoryItem;
        $this->authorizeItemForUser($request, $item);
        $this->cancelReservationSale($item, $sale);

        return response()->json($this->serializeSale($sale->fresh()->load(['inventoryItem', 'user', 'payments', 'serviceCustomer'])));
    }

    public function complete(Request $request, Sale $sale): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales()) {
            return response()->json(['message' => 'No tienes permiso para registrar ventas.'], 403);
        }

        if (! $sale->isActiveReservation()) {
            return response()->json(['message' => 'Esta venta no es un apartado activo.'], 422);
        }

        $item = $sale->inventoryItem()->firstOrFail();
        $this->authorizeItemForUser($request, $item);
        InventoryStatusGuard::assertAvailableForSale($item);

        $data = $this->validateCompletionPayload($request);
        $salePrice = MoneyFormatter::parse($data['sale_price'] ?? $sale->sale_price);
        $existingPaid = (float) $sale->payments()->sum('amount');
        $newPayments = $this->resolveCompletionPayments($data, $salePrice, $existingPaid);
        $newPaid = collect($newPayments)->sum('amount');
        $totalPaid = round($existingPaid + $newPaid, 2);

        if ($totalPaid > $salePrice) {
            return response()->json(['message' => 'El total pagado no puede superar el precio de venta.'], 422);
        }

        $amountDue = max(0, $salePrice - $totalPaid);
        $merged = array_merge([
            'payment_method' => $data['payment_method'] ?? $sale->payment_method,
            'credit_payment_method_id' => $sale->credit_payment_method_id,
            'credit_term_type' => $sale->credit_term_type,
        ], $data);

        $this->assertCreditRequirements($merged, $amountDue);

        ServiceCustomerResolver::resolveIntoPayload($data);

        $soldAt = isset($data['sold_at']) ? Carbon::parse($data['sold_at']) : now();
        $creditDueAt = $this->resolveCreditDueAt($merged, $soldAt, $amountDue);
        $creditStatus = $amountDue > 0 ? 'pending' : 'paid';

        DB::transaction(function () use ($sale, $item, $user, $data, $newPayments, $totalPaid, $amountDue, $creditStatus, $soldAt, $creditDueAt) {
            $oldStatus = $item->status;

            foreach ($newPayments as $payment) {
                if ((float) $payment['amount'] <= 0) {
                    continue;
                }
                SalePayment::create([
                    'sale_id' => $sale->id,
                    'user_id' => $user->id,
                    'method' => $payment['method'],
                    'amount' => $payment['amount'],
                    'notes' => $payment['notes'] ?? null,
                    'paid_at' => $soldAt,
                ]);
            }

            $item->update(['status' => InventoryStatus::VENDIDO]);

            $sale->update([
                'sale_price' => $data['sale_price'] ?? $sale->sale_price,
                'purchase_price_at_sale' => $item->purchase_price,
                'payment_method' => $data['payment_method'] ?? $sale->payment_method,
                'credit_payment_method_id' => $data['credit_payment_method_id'] ?? $sale->credit_payment_method_id,
                'credit_term_type' => $data['credit_term_type'] ?? $sale->credit_term_type,
                'credit_due_at' => $creditDueAt,
                'credit_status' => $creditStatus,
                'amount_paid' => $totalPaid,
                'amount_due' => $amountDue,
                'customer_name' => $data['customer_name'] ?? $sale->customer_name,
                'customer_phone' => $data['customer_phone'] ?? $sale->customer_phone,
                'service_customer_id' => $data['service_customer_id'] ?? $sale->service_customer_id,
                'notes' => $data['notes'] ?? $sale->notes,
                'sold_at' => $soldAt,
                'reservation_status' => null,
            ]);

            $this->movements->record($item, 'venta', 'status', $oldStatus, InventoryStatus::VENDIDO, 'Venta completada (apartado)', [
                'sale_id' => $sale->id,
                'sale_price' => $data['sale_price'] ?? $sale->sale_price,
                'remission_number' => $sale->remission_number,
            ]);

            $this->audit->log($sale, 'reservation_completed');
        });

        return response()->json(
            $this->serializeSale($sale->fresh()->load(['inventoryItem', 'user', 'payments', 'serviceCustomer', 'creditPaymentMethod']))
        );
    }

    public static function activeReservationForItem(string $itemId): ?Sale
    {
        return Sale::query()
            ->where('inventory_item_id', $itemId)
            ->where('reservation_status', SaleReservationStatus::ACTIVE)
            ->first();
    }

    private function cancelReservationSale(InventoryItem $item, Sale $sale): void
    {
        DB::transaction(function () use ($item, $sale) {
            $oldStatus = $item->status;

            $sale->update(['reservation_status' => SaleReservationStatus::CANCELLED]);
            $item->update(['status' => InventoryStatus::DISPONIBLE]);

            $this->movements->record($item, 'status_change', 'status', $oldStatus, InventoryStatus::DISPONIBLE, 'Apartado cancelado', [
                'sale_id' => $sale->id,
                'remission_number' => $sale->remission_number,
            ]);

            $this->audit->log($sale, 'reservation_cancelled');
        });
    }

    private function assertCanManageReservation($user): void
    {
        if ($user->canManageSales() || (InventoryFieldGuard::canUpdateStatus($user) && $user->canManageInventory())) {
            return;
        }

        abort(403, 'No tienes permiso para gestionar apartados.');
    }

    private function authorizeItemForUser(Request $request, InventoryItem $item): void
    {
        $user = $request->user();
        if ($user->isSupplier() && $user->supplier_id && $item->supplier_id !== $user->supplier_id) {
            abort(403, 'No tienes acceso a este equipo.');
        }
    }

    private function validateCompletionPayload(Request $request): array
    {
        return $request->validate([
            'sale_price' => ['sometimes', 'string', 'max:50'],
            'payment_method' => ['required', Rule::in(PaymentMethods::salePrimary())],
            'customer_name' => ['nullable', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'service_customer_id' => ['nullable', 'uuid', 'exists:service_customers,id'],
            'notes' => ['nullable', 'string'],
            'sold_at' => ['nullable', 'date'],
            'credit_payment_method_id' => ['nullable', 'uuid', 'exists:credit_payment_methods,id'],
            'credit_term_type' => ['nullable', Rule::in(['8_days', '15_days', 'custom'])],
            'credit_due_at' => ['nullable', 'date'],
            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['required_with:payments', Rule::in(PaymentMethods::mixedLine())],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'min:0'],
            'payments.*.notes' => ['nullable', 'string'],
        ]);
    }

    /** @return list<array{method: string, amount: float|int|string, notes?: string}> */
    private function resolveCompletionPayments(array $data, float $salePrice, float $existingPaid): array
    {
        $remaining = max(0, $salePrice - $existingPaid);
        $method = $data['payment_method'];

        if ($method === 'mixto') {
            if (empty($data['payments']) || count($data['payments']) < 2) {
                throw ValidationException::withMessages([
                    'payments' => ['Indica al menos dos pagos para venta mixta.'],
                ]);
            }

            foreach ($data['payments'] as $payment) {
                if (($payment['method'] ?? '') === 'credito') {
                    throw ValidationException::withMessages([
                        'payments' => ['En pago mixto usa métodos de contado. El saldo pendiente se registra con medio de crédito.'],
                    ]);
                }
            }

            return $data['payments'];
        }

        if ($method === 'credito') {
            return [];
        }

        if ($remaining <= 0) {
            return [];
        }

        return [['method' => $method, 'amount' => $remaining]];
    }

    private function assertCreditRequirements(array $data, float $amountDue): void
    {
        $isCreditSale = ($data['payment_method'] ?? '') === 'credito' || $amountDue > 0;

        if (! $isCreditSale) {
            return;
        }

        if (empty($data['credit_payment_method_id'])) {
                throw ValidationException::withMessages([
                'credit_payment_method_id' => ['Selecciona el medio de pago de crédito para el saldo pendiente.'],
            ]);
        }

        $method = CreditPaymentMethod::query()
                ->where('id', $data['credit_payment_method_id'])
                ->where('is_active', true)
                ->first();

            if (! $method) {
            throw ValidationException::withMessages([
                'credit_payment_method_id' => ['El medio de pago de crédito no está disponible.'],
            ]);
        }

        if (empty($data['credit_term_type'])) {
            throw ValidationException::withMessages([
                'credit_term_type' => ['Selecciona el plazo de crédito para el saldo pendiente.'],
            ]);
        }
    }

    private function resolveCreditDueAt(array $data, Carbon $soldAt, float $amountDue): ?Carbon
    {
        if ($amountDue <= 0 || empty($data['credit_term_type'])) {
            return null;
        }

        $customDue = ! empty($data['credit_due_at']) ? Carbon::parse($data['credit_due_at']) : null;

        return CreditTermCalculator::resolveDueAt($data['credit_term_type'], $soldAt, $customDue);
    }

    private function serializeSale(Sale $sale): array
    {
        return [
            'id' => $sale->id,
            'remission_number' => $sale->remission_number,
            'inventory_item_id' => $sale->inventory_item_id,
            'inventory_item' => $sale->inventoryItem,
            'user' => $sale->user ? ['id' => $sale->user->id, 'name' => $sale->user->name] : null,
            'sale_price' => $sale->sale_price,
            'payment_method' => $sale->payment_method,
            'credit_payment_method_id' => $sale->credit_payment_method_id,
            'credit_payment_method' => $sale->creditPaymentMethod ? [
                'id' => $sale->creditPaymentMethod->id,
                'name' => $sale->creditPaymentMethod->name,
                'slug' => $sale->creditPaymentMethod->slug,
            ] : null,
            'credit_term_type' => $sale->credit_term_type,
            'credit_due_at' => $sale->credit_due_at,
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
            'reserved_at' => $sale->reserved_at,
            'reservation_status' => $sale->reservation_status,
            'payments' => $sale->payments,
            'created_at' => $sale->created_at,
        ];
    }
}

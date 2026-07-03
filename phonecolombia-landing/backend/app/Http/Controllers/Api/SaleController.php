<?php



namespace App\Http\Controllers\Api;



use App\Http\Controllers\Concerns\ScopesInventoryForUser;

use App\Http\Controllers\Controller;

use App\Http\Controllers\Api\SaleReservationController;
use App\Models\CreditPaymentMethod;

use App\Models\InventoryItem;

use App\Models\Sale;

use App\Models\SalePayment;

use App\Models\ServiceCustomer;

use App\Services\AuditService;

use App\Services\InventoryMovementService;

use App\Support\CreditTermCalculator;

use App\Support\BrandLogo;
use App\Support\InventoryStatus;
use App\Support\InventoryStatusGuard;

use App\Support\MoneyFormatter;
use App\Support\PaymentMethods;

use App\Support\RemissionNumberGenerator;
use App\Support\ServiceCustomerResolver;

use Carbon\Carbon;

use Barryvdh\DomPDF\Facade\Pdf;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;

use Illuminate\Support\Facades\DB;

use Illuminate\Validation\Rule;

use Symfony\Component\HttpFoundation\StreamedResponse;



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

            ->with(['inventoryItem', 'user', 'payments', 'serviceCustomer', 'creditPaymentMethod'])

            ->orderByRaw('COALESCE(sold_at, reserved_at, created_at) DESC');



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

        if ($request->filled('q')) {

            $term = '%'.$request->string('q').'%';

            $query->where(function ($q) use ($term) {

                $q->where('remission_number', 'like', $term)

                    ->orWhere('customer_name', 'like', $term)

                    ->orWhereHas('inventoryItem', fn ($itemQuery) => $itemQuery

                        ->where('name', 'like', $term)

                        ->orWhere('imei', 'like', $term)

                        ->orWhere('barcode', 'like', $term));

            });

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



        $data = $this->validateSalePayload($request);



        $item = InventoryItem::findOrFail($data['inventory_item_id']);

        $this->authorizeItemForUser($request, $item);

        InventoryStatusGuard::assertAvailableForSale($item);

        $activeReservation = SaleReservationController::activeReservationForItem($item->id);
        if ($activeReservation) {
            return response()->json([
                'message' => 'Este equipo tiene un apartado activo. Complétalo desde ventas.',
                'reservation_sale_id' => $activeReservation->id,
            ], 422);
        }

        $salePrice = MoneyFormatter::parse($data['sale_price']);

        $payments = $this->resolvePayments($data, $salePrice);

        [$amountPaid, $amountDue, $creditStatus] = $this->amountsFromPayments($salePrice, $payments);



        $this->assertCreditRequirements($data, $amountDue);



        ServiceCustomerResolver::resolveIntoPayload($data);



        $soldAt = isset($data['sold_at']) ? Carbon::parse($data['sold_at']) : now();

        $creditDueAt = $this->resolveCreditDueAt($data, $soldAt, $amountDue);



        $sale = DB::transaction(function () use ($data, $item, $user, $payments, $amountPaid, $amountDue, $creditStatus, $soldAt, $creditDueAt) {

            $oldStatus = $item->status;

            $item->update(['status' => InventoryStatus::VENDIDO]);



            $sale = Sale::create([

                'remission_number' => RemissionNumberGenerator::next(),

                'inventory_item_id' => $item->id,

                'user_id' => $user->id,

                'service_customer_id' => $data['service_customer_id'] ?? null,

                'sale_price' => $data['sale_price'],

                'purchase_price_at_sale' => $item->purchase_price,

                'payment_method' => $data['payment_method'],

                'credit_payment_method_id' => $data['credit_payment_method_id'] ?? null,

                'credit_term_type' => $data['credit_term_type'] ?? null,

                'credit_due_at' => $creditDueAt,

                'credit_status' => $creditStatus,

                'amount_paid' => $amountPaid,

                'amount_due' => $amountDue,

                'customer_name' => $data['customer_name'] ?? null,

                'customer_phone' => $data['customer_phone'] ?? null,

                'notes' => $data['notes'] ?? null,

                'sold_at' => $soldAt,

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

                    'paid_at' => $soldAt,

                ]);

            }



            $this->movements->record($item, 'venta', 'status', $oldStatus, InventoryStatus::VENDIDO, 'Venta registrada', [

                'sale_id' => $sale->id,

                'remission_number' => $sale->remission_number,

                'sale_price' => $data['sale_price'],

            ]);

            $this->audit->log($sale, 'created');

            if ($amountPaid > 0) {
                $this->audit->log($sale, 'payment_added', 'amount_paid', 0, $amountPaid, [
                    'remission_number' => $sale->remission_number,
                    'source' => 'initial_sale',
                    'payments' => collect($payments)
                        ->filter(fn (array $payment) => (float) ($payment['amount'] ?? 0) > 0)
                        ->map(fn (array $payment) => [
                            'method' => $payment['method'],
                            'amount' => (float) $payment['amount'],
                            'paid_at' => $soldAt->toIso8601String(),
                            'notes' => $payment['notes'] ?? null,
                        ])
                        ->values()
                        ->all(),
                ]);
            }



            return $sale;

        });



        return response()->json($this->serializeSale($sale->load(['inventoryItem', 'user', 'payments', 'creditPaymentMethod'])), 201);

    }



    public function update(Request $request, Sale $sale): JsonResponse

    {

        $user = $request->user();

        if (! $user->canManageSales()) {

            return response()->json(['message' => 'No tienes permiso para editar ventas.'], 403);

        }

        if ($sale->isReturned()) {
            return response()->json(['message' => 'No se puede editar una venta devuelta por retoma.'], 422);
        }



        if ($user->isSupplier() && $user->supplier_id) {

            $sale->load('inventoryItem');

            if ($sale->inventoryItem?->supplier_id !== $user->supplier_id) {

                abort(403, 'No tienes acceso a esta venta.');

            }

        }



        $data = $this->validateSalePayload($request, updating: true);



        $salePrice = MoneyFormatter::parse($data['sale_price'] ?? $sale->sale_price);

        $paymentMethod = $data['payment_method'] ?? $sale->payment_method;

        $amountPaid = (float) $sale->amount_paid;

        $amountDue = max(0, $salePrice - $amountPaid);

        $creditStatus = $amountDue > 0 ? 'pending' : 'paid';



        $merged = array_merge([

            'payment_method' => $paymentMethod,

            'credit_payment_method_id' => $sale->credit_payment_method_id,

            'credit_term_type' => $sale->credit_term_type,

            'credit_due_at' => $sale->credit_due_at?->toIso8601String(),

        ], $data);



        $this->assertCreditRequirements($merged, $amountDue);



        ServiceCustomerResolver::resolveIntoPayload($data);



        $soldAt = isset($data['sold_at']) ? Carbon::parse($data['sold_at']) : $sale->sold_at;

        $creditDueAt = $this->resolveCreditDueAt($merged, $soldAt, $amountDue);



        DB::transaction(function () use ($sale, $data, $salePrice, $paymentMethod, $amountDue, $creditStatus, $soldAt, $creditDueAt) {

            $original = $sale->getAttributes();

            if (array_key_exists('sale_price', $data)) {

                $sale->sale_price = $data['sale_price'];

            }

            if (array_key_exists('payment_method', $data)) {

                $sale->payment_method = $paymentMethod;

            }

            if (array_key_exists('credit_payment_method_id', $data)) {

                $sale->credit_payment_method_id = $data['credit_payment_method_id'] ?: null;

            }

            if (array_key_exists('credit_term_type', $data)) {

                $sale->credit_term_type = $data['credit_term_type'] ?: null;

            }

            if (array_key_exists('customer_name', $data)) {

                $sale->customer_name = $data['customer_name'] ?: null;

            }

            if (array_key_exists('customer_phone', $data)) {

                $sale->customer_phone = $data['customer_phone'] ?: null;

            }

            if (array_key_exists('service_customer_id', $data)) {

                $sale->service_customer_id = $data['service_customer_id'] ?: null;

            }

            if (array_key_exists('notes', $data)) {

                $sale->notes = $data['notes'] ?: null;

            }

            if (array_key_exists('sold_at', $data)) {

                $sale->sold_at = $soldAt;

            }



            $sale->amount_due = $amountDue;

            $sale->credit_status = $creditStatus;

            $sale->credit_due_at = $creditDueAt;

            $sale->save();

            $changes = $sale->getChanges();
            unset($changes['updated_at']);
            if ($changes !== []) {
                $this->audit->logChanges($sale, $original, $changes);
            }

        });



        return response()->json($this->serializeSale($sale->fresh()->load(['inventoryItem', 'user', 'payments', 'creditPaymentMethod'])));

    }



    public function addPayment(Request $request, Sale $sale): JsonResponse

    {

        $user = $request->user();

        if (! $user->canManageSales()) {

            return response()->json(['message' => 'No tienes permiso.'], 403);

        }



        $data = $request->validate([

            'method' => ['required', Rule::in([...PaymentMethods::immediate(), PaymentMethods::MIXTO])],

            'amount' => ['required_unless:method,mixto', 'nullable', 'numeric', 'min:0.01'],

            'payments' => ['nullable', 'array'],

            'payments.*.method' => ['required_with:payments', Rule::in(PaymentMethods::mixedLine())],

            'payments.*.amount' => ['required_with:payments', 'numeric', 'min:0.01'],

            'notes' => ['nullable', 'string'],

            'paid_at' => ['nullable', 'date'],

        ]);



        if ($sale->isReturned()) {
            return response()->json(['message' => 'Esta venta fue devuelta por retoma.'], 422);
        }

        if ($sale->credit_status === 'paid') {
            return response()->json(['message' => 'Esta venta ya está pagada en su totalidad.'], 422);
        }



        $amountDue = (float) $sale->amount_due;

        $paymentLines = $this->resolveAbonoPaymentLines($data, $amountDue);

        $paidAt = isset($data['paid_at']) ? Carbon::parse($data['paid_at']) : now();



        DB::transaction(function () use ($sale, $paymentLines, $user, $paidAt) {

            $previousAmountPaid = (float) $sale->amount_paid;
            $createdPayments = [];

            foreach ($paymentLines as $line) {

                $payment = SalePayment::create([

                    'sale_id' => $sale->id,

                    'user_id' => $user->id,

                    'method' => $line['method'],

                    'amount' => $line['amount'],

                    'notes' => $line['notes'] ?? null,

                    'paid_at' => $paidAt,

                ]);

                $createdPayments[] = [
                    'id' => $payment->id,
                    'method' => $payment->method,
                    'amount' => (float) $payment->amount,
                    'paid_at' => $payment->paid_at?->toIso8601String(),
                    'notes' => $payment->notes,
                ];

            }



            $sale->amount_paid = $sale->payments()->sum('amount');

            $sale->amount_due = max(0, MoneyFormatter::parse($sale->sale_price) - $sale->amount_paid);

            $sale->credit_status = $sale->amount_due > 0 ? 'pending' : 'paid';

            $sale->save();

            $this->audit->log($sale, 'payment_added', 'amount_paid', $previousAmountPaid, (float) $sale->amount_paid, [
                'remission_number' => $sale->remission_number,
                'payments' => $createdPayments,
            ]);

        });



        return response()->json($this->serializeSale($sale->fresh()->load(['inventoryItem', 'user', 'payments', 'creditPaymentMethod'])));

    }



    public function showRemission(Request $request, Sale $sale): JsonResponse
    {
        $sale = $this->authorizeAndLoadRemissionSale($request, $sale);
        $payload = $this->remissionDocumentPayload($sale);

        return response()->json([
            'sale_id' => $sale->id,
            ...$payload,
        ]);
    }

    public function exportRemissionPdf(Request $request, Sale $sale): StreamedResponse
    {
        $sale = $this->authorizeAndLoadRemissionSale($request, $sale);
        $payload = $this->remissionDocumentPayload($sale);
        $filename = 'remision_'.str_replace('/', '-', $sale->remission_number).'.pdf';

        $pdf = Pdf::loadView('reports.remission-pdf', [
            'sale' => $payload,
            'generatedAt' => now()->timezone('America/Bogota')->format('d/m/Y H:i'),
            'logoDataUri' => BrandLogo::remissionDataUri(),
        ])->setPaper('letter', 'portrait');

        return response()->streamDownload(
            fn () => print ($pdf->output()),
            $filename,
            ['Content-Type' => 'application/pdf'],
        );
    }

    private function authorizeAndLoadRemissionSale(Request $request, Sale $sale): Sale
    {
        $user = $request->user();
        if (! $user->canViewRemissions() && ! $user->isSuperAdmin()) {
            abort(403, 'No tienes permiso para ver remisiones.');
        }

        if ($user->isSupplier() && $user->supplier_id) {
            $sale->load('inventoryItem');
            if ($sale->inventoryItem?->supplier_id !== $user->supplier_id) {
                abort(403, 'No tienes acceso a esta venta.');
            }
        }

        $sale->load(['inventoryItem', 'user', 'payments', 'creditPaymentMethod', 'serviceCustomer']);

        return $sale;
    }

    /** @return array<string, mixed> */
    private function remissionDocumentPayload(Sale $sale): array

    {

        $paymentLabels = PaymentMethods::labels();



        $isApartado = $sale->reservation_status === \App\Support\SaleReservationStatus::ACTIVE;

        $documentDate = $sale->sold_at ?? $sale->reserved_at ?? $sale->created_at;



        return [

            'remission_number' => $sale->remission_number,

            'status_label' => $isApartado ? 'Apartado' : ($sale->sold_at ? 'Entregado' : 'Registrado'),

            'status_class' => $isApartado ? 'badge--apartado' : ($sale->sold_at ? 'badge--entregado' : 'badge--registrado'),

            'customer' => $sale->serviceCustomer?->name ?? $sale->customer_name,

            'customer_phone' => $sale->customer_phone ?? $sale->serviceCustomer?->phone,

            'seller' => $sale->user?->name,

            'document_date' => $documentDate?->timezone('America/Bogota')->format('d/m/Y H:i') ?? '—',

            'item' => $sale->inventoryItem?->name,

            'imei' => $sale->inventoryItem?->imei ?? $sale->inventoryItem?->barcode,

            'color' => $sale->inventoryItem?->color,

            'sale_price' => MoneyFormatter::parse($sale->sale_price),

            'amount_paid' => (float) $sale->amount_paid,

            'amount_due' => (float) $sale->amount_due,

            'payment_method_label' => $paymentLabels[$sale->payment_method] ?? $sale->payment_method,

            'credit_payment_method' => $sale->creditPaymentMethod?->name,

            'notes' => $sale->notes,

            'payments' => $sale->payments->map(fn (SalePayment $payment) => [

                'paid_at' => $payment->paid_at?->timezone('America/Bogota')->format('d/m/Y H:i') ?? '—',

                'method' => $paymentLabels[$payment->method] ?? $payment->method,

                'amount' => (float) $payment->amount,

                'notes' => $payment->notes,

            ])->values()->all(),

        ];

    }



    private function validateSalePayload(Request $request, bool $updating = false): array

    {

        $rules = [

            'sale_price' => [$updating ? 'sometimes' : 'required', 'string', 'max:50'],

            'payment_method' => [$updating ? 'sometimes' : 'required', Rule::in(PaymentMethods::salePrimary())],

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

        ];



        if (! $updating) {

            $rules['inventory_item_id'] = ['required', 'uuid', 'exists:inventory_items,id'];

        }



        return $request->validate($rules);

    }



    private function resolvePayments(array $data, float $salePrice): array

    {

        if ($data['payment_method'] === 'mixto') {

            if (empty($data['payments']) || count($data['payments']) < 2) {

                abort(response()->json([

                    'message' => 'El pago mixto requiere al menos dos líneas de pago.',

                    'errors' => ['payments' => ['Indica al menos dos pagos para venta mixta.']],

                ], 422));

            }

            foreach ($data['payments'] as $payment) {
                if (($payment['method'] ?? '') === 'credito') {
                    abort(response()->json([
                        'message' => 'En pago mixto usa métodos de contado. El saldo pendiente se registra con medio de crédito.',
                        'errors' => ['payments' => ['No uses crédito como línea del mixto.']],
                    ], 422));
                }
            }

            return $data['payments'];

        }



        return $data['payments'] ?? $this->defaultPayments($data['payment_method'], $salePrice);

    }



    /** @return array{0: float, 1: float, 2: string} */

    private function amountsFromPayments(float $salePrice, array $payments): array

    {

        $amountPaid = collect($payments)->sum('amount');

        if ($amountPaid > $salePrice) {

            abort(response()->json([

                'message' => 'El total pagado no puede superar el precio de venta.',

            ], 422));

        }

        $amountDue = max(0, $salePrice - $amountPaid);



        return [$amountPaid, $amountDue, $amountDue > 0 ? 'pending' : 'paid'];

    }



    private function assertCreditRequirements(array $data, float $amountDue): void

    {

        $isCreditSale = ($data['payment_method'] ?? '') === 'credito' || $amountDue > 0;

        if (! $isCreditSale) {

            return;

        }



        if (empty($data['credit_payment_method_id'])) {

            abort(response()->json([

                'message' => 'Debes seleccionar el medio de pago de crédito (Addi, Sistecredito, etc.).',

                'errors' => ['credit_payment_method_id' => ['El medio de pago de crédito es obligatorio.']],

            ], 422));

        }



        $method = CreditPaymentMethod::query()

            ->where('id', $data['credit_payment_method_id'])

            ->where('is_active', true)

            ->first();



        if (! $method) {

            abort(response()->json([

                'message' => 'El medio de pago de crédito seleccionado no está disponible.',

            ], 422));

        }



        if (empty($data['credit_term_type'])) {

            abort(response()->json([

                'message' => 'Debes seleccionar el plazo de crédito.',

                'errors' => ['credit_term_type' => ['El plazo de crédito es obligatorio.']],

            ], 422));

        }

    }



    private function resolveCreditDueAt(array $data, Carbon $soldAt, float $amountDue): ?Carbon

    {

        if (($data['payment_method'] ?? '') !== 'credito' && $amountDue <= 0) {

            return null;

        }



        if (empty($data['credit_term_type'])) {

            return null;

        }



        $customDue = ! empty($data['credit_due_at']) ? Carbon::parse($data['credit_due_at']) : null;



        return CreditTermCalculator::resolveDueAt($data['credit_term_type'], $soldAt, $customDue);

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

    /** @return list<array{method: string, amount: float|int|string, notes?: string|null}> */
    private function resolveAbonoPaymentLines(array $data, float $amountDue): array
    {
        if ($data['method'] === 'mixto') {
            if (empty($data['payments']) || count($data['payments']) < 2) {
                abort(response()->json([
                    'message' => 'El abono mixto requiere al menos dos líneas de pago.',
                    'errors' => ['payments' => ['Indica al menos dos pagos para abono mixto.']],
                ], 422));
            }

            $lines = collect($data['payments'])
                ->filter(fn ($payment) => (float) ($payment['amount'] ?? 0) > 0)
                ->values()
                ->all();

            if (count($lines) < 2) {
                abort(response()->json([
                    'message' => 'El abono mixto requiere al menos dos líneas con monto.',
                    'errors' => ['payments' => ['Indica al menos dos pagos para abono mixto.']],
                ], 422));
            }

            $total = collect($lines)->sum(fn ($payment) => (float) $payment['amount']);
            if ($total > $amountDue + 0.009) {
                abort(response()->json([
                    'message' => 'El abono no puede superar el saldo pendiente.',
                    'errors' => ['amount' => ['Saldo pendiente: '.MoneyFormatter::format($amountDue)]],
                ], 422));
            }

            $notes = $data['notes'] ?? null;

            return array_map(fn ($payment) => [
                'method' => $payment['method'],
                'amount' => $payment['amount'],
                'notes' => $notes,
            ], $lines);
        }

        if ((float) $data['amount'] > $amountDue + 0.009) {
            abort(response()->json([
                'message' => 'El abono no puede superar el saldo pendiente.',
                'errors' => ['amount' => ['Saldo pendiente: '.MoneyFormatter::format($amountDue)]],
            ], 422));
        }

        return [[
            'method' => $data['method'],
            'amount' => $data['amount'],
            'notes' => $data['notes'] ?? null,
        ]];
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

            'returned_at' => $sale->returned_at,

            'retake_price' => $sale->retake_price,

            'retake_payment_method' => $sale->retake_payment_method,

            'is_returned' => $sale->isReturned(),

            'reserved_at' => $sale->reserved_at,

            'reservation_status' => $sale->reservation_status,

            'payments' => $sale->payments,

            'created_at' => $sale->created_at,

        ];

    }

}



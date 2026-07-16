<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashMovement;
use App\Support\MoneyFormatter;
use App\Support\PaymentMethods;
use App\Support\ReportPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class CashMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales()) {
            abort(403);
        }

        [$periodStart, $periodEnd] = ReportPeriod::resolve($request);

        $movements = CashMovement::query()
            ->with('user:id,name')
            ->whereBetween('occurred_at', [$periodStart, $periodEnd])
            ->orderByDesc('occurred_at')
            ->limit(100)
            ->get()
            ->map(fn (CashMovement $m) => $this->mapMovement($m))
            ->values();

        return response()->json(['data' => $movements]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales()) {
            abort(403);
        }

        $data = $request->validate([
            'type' => ['required', Rule::in(CashMovement::types())],
            'method' => ['required', Rule::in(PaymentMethods::immediate())],
            'amount' => ['required'],
            'concept' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'occurred_at' => ['nullable', 'date'],
        ]);

        $amount = MoneyFormatter::parse($data['amount']);
        if ($amount <= 0) {
            return response()->json([
                'message' => 'El monto debe ser mayor a cero.',
                'errors' => ['amount' => ['El monto debe ser mayor a cero.']],
            ], 422);
        }

        $occurredAt = isset($data['occurred_at'])
            ? Carbon::parse($data['occurred_at'], ReportPeriod::TIMEZONE)->timezone(config('app.timezone') ?: 'UTC')
            : now();

        $movement = CashMovement::create([
            'user_id' => $user->id,
            'type' => $data['type'],
            'method' => $data['method'],
            'amount' => round($amount, 2),
            'concept' => trim((string) ($data['concept'] ?? '')) ?: null,
            'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
            'occurred_at' => $occurredAt,
        ]);

        $movement->load('user:id,name');

        return response()->json($this->mapMovement($movement), 201);
    }

    public function destroy(Request $request, CashMovement $cashMovement): JsonResponse
    {
        $user = $request->user();
        if (! $user->canManageSales()) {
            abort(403);
        }

        $cashMovement->delete();

        return response()->json(['ok' => true]);
    }

    /** @return array<string, mixed> */
    private function mapMovement(CashMovement $movement): array
    {
        return [
            'id' => $movement->id,
            'type' => $movement->type,
            'type_label' => CashMovement::typeLabel((string) $movement->type),
            'method' => $movement->method,
            'method_label' => PaymentMethods::label((string) $movement->method),
            'amount' => (float) $movement->amount,
            'concept' => $movement->concept,
            'notes' => $movement->notes,
            'occurred_at' => $movement->occurred_at?->timezone(ReportPeriod::TIMEZONE)->format('Y-m-d H:i:s'),
            'user' => $movement->user ? [
                'id' => $movement->user->id,
                'name' => $movement->user->name,
            ] : null,
            'origen' => 'manual',
            'origen_label' => 'Manual',
        ];
    }
}

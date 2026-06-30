<?php

namespace App\Support;

use App\Models\CreditSetting;
use Carbon\Carbon;

final class CreditTermCalculator
{
    public static function resolveDueAt(string $termType, Carbon $soldAt, ?Carbon $customDueAt = null): ?Carbon
    {
        return match ($termType) {
            '8_days' => $soldAt->copy()->addDays(8)->endOfDay(),
            '15_days' => $soldAt->copy()->addDays(15)->endOfDay(),
            'custom' => $customDueAt?->copy()->endOfDay() ?? self::nextBillingDate($soldAt),
            default => null,
        };
    }

    public static function nextBillingDate(Carbon $from): Carbon
    {
        $billingDay = max(1, min(28, CreditSetting::current()->billing_day));

        $target = $from->day <= $billingDay
            ? $from->copy()
            : $from->copy()->addMonth();

        $day = min($billingDay, $target->daysInMonth);

        return $target->copy()->day($day)->endOfDay();
    }
}

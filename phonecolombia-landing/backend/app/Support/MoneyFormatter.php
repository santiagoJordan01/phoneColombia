<?php

namespace App\Support;

final class MoneyFormatter
{
    public static function parse(?string $value): float
    {
        if ($value === null || $value === '') {
            return 0.0;
        }

        return (float) preg_replace('/[^\d.]/', '', $value);
    }

    public static function format(float|int|string|null $value): string
    {
        $amount = is_numeric($value) ? (float) $value : self::parse((string) $value);

        return '$'.number_format($amount, 2, ',', '.');
    }
}

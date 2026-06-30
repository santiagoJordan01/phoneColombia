<?php

namespace App\Support;

use App\Models\Sale;

final class SaleCostResolver
{
    public static function purchasePriceAtSale(Sale $sale): float
    {
        if ($sale->purchase_price_at_sale !== null && $sale->purchase_price_at_sale !== '') {
            return MoneyFormatter::parse($sale->purchase_price_at_sale);
        }

        return MoneyFormatter::parse($sale->inventoryItem?->purchase_price);
    }

    public static function netProfit(Sale $sale): float
    {
        $salePrice = MoneyFormatter::parse($sale->sale_price);

        return round($salePrice - self::purchasePriceAtSale($sale), 2);
    }

    /** @return array<string, float> */
    public static function collectedByPaymentMethod(Sale $sale): array
    {
        $payments = $sale->relationLoaded('payments')
            ? $sale->payments
            : $sale->payments()->get();

        if ($payments->isNotEmpty()) {
            return $payments
                ->groupBy('method')
                ->map(fn ($group) => round((float) $group->sum('amount'), 2))
                ->all();
        }

        if ((float) $sale->amount_paid > 0 && $sale->payment_method) {
            return [(string) $sale->payment_method => round((float) $sale->amount_paid, 2)];
        }

        return [];
    }
}

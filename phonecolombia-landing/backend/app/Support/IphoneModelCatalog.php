<?php

namespace App\Support;

use App\Models\InventoryProduct;

class IphoneModelCatalog
{
    public const BRAND = 'IPHONE';

    /**
     * Modelos iPhone comercializados (línea principal, SE y variantes Plus/Pro/Max/Mini/e).
     *
     * @return list<string>
     */
    public static function models(): array
    {
        return [
            '2G',
            '3G',
            '3GS',
            '4',
            '4S',
            '5',
            '5C',
            '5S',
            '6',
            '6 PLUS',
            '6S',
            '6S PLUS',
            'SE',
            '7',
            '7 PLUS',
            '8',
            '8 PLUS',
            'X',
            'XR',
            'XS',
            'XS MAX',
            '11',
            '11 PRO',
            '11 PRO MAX',
            'SE 2020',
            '12 MINI',
            '12',
            '12 PRO',
            '12 PRO MAX',
            '13 MINI',
            '13',
            '13 PRO',
            '13 PRO MAX',
            'SE 2022',
            '14',
            '14 PLUS',
            '14 PRO',
            '14 PRO MAX',
            '15',
            '15 PLUS',
            '15 PRO',
            '15 PRO MAX',
            '16',
            '16 PLUS',
            '16 PRO',
            '16 PRO MAX',
            '16E',
        ];
    }

    /** Inserta modelos que aún no existen en el catálogo. Devuelve cuántos se crearon. */
    public static function seedMissing(): int
    {
        $created = 0;

        foreach (self::models() as $model) {
            $model = strtoupper(trim($model));
            $name = self::BRAND.' '.$model;

            $product = InventoryProduct::query()->firstOrCreate(
                ['name' => $name],
                [
                    'brand' => self::BRAND,
                    'model' => $model,
                    'category' => 'celular',
                ],
            );

            if ($product->wasRecentlyCreated) {
                $created++;
            }
        }

        return $created;
    }
}

<?php

namespace App\Support;

class PaymentMethods
{
    public const EFECTIVO = 'efectivo';

    public const TRANSFERENCIA = 'transferencia';

    public const NEQUI = 'nequi';

    public const DAVIPLATA = 'daviplata';

    public const BANCOLOMBIA = 'bancolombia';

    public const TARJETA = 'tarjeta';

    public const CREDITO = 'credito';

    public const MIXTO = 'mixto';

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            self::EFECTIVO => 'Efectivo',
            self::TRANSFERENCIA => 'Transferencia bancaria',
            self::NEQUI => 'Nequi',
            self::DAVIPLATA => 'Daviplata',
            self::BANCOLOMBIA => 'Bancolombia',
            self::TARJETA => 'Tarjeta / datáfono',
            self::CREDITO => 'Crédito',
            self::MIXTO => 'Mixto',
        ];
    }

    /** Cobros inmediatos (venta, abono, apartado, retoma). */
    public static function immediate(): array
    {
        return [
            self::EFECTIVO,
            self::TRANSFERENCIA,
            self::NEQUI,
            self::DAVIPLATA,
            self::BANCOLOMBIA,
            self::TARJETA,
        ];
    }

    /** Método principal de una venta o apartado. */
    public static function salePrimary(): array
    {
        return [...self::immediate(), self::CREDITO, self::MIXTO];
    }

    /** Líneas de pago mixto o abono mixto. */
    public static function mixedLine(): array
    {
        return self::immediate();
    }

    public static function label(string $method): string
    {
        return self::labels()[$method] ?? $method;
    }
}

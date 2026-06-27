<?php

namespace App\Support;

final class InventoryStatus
{
    public const DISPONIBLE = 'disponible';

    public const VENDIDO = 'vendido';

    public const RETOMADO = 'retomado';

    public const SEPARADO = 'separado';

    public const SERVICIO_TECNICO = 'servicio_tecnico';

    public const ALL = [
        self::DISPONIBLE,
        self::VENDIDO,
        self::RETOMADO,
        self::SEPARADO,
        self::SERVICIO_TECNICO,
    ];
}

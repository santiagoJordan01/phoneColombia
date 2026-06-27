<?php

namespace App\Support;

final class ServiceTicketType
{
    public const INVENTARIO = 'inventario';

    public const CLIENTE_EXTERNO = 'cliente_externo';

    public const GARANTIA = 'garantia';

    public const ALL = [
        self::INVENTARIO,
        self::CLIENTE_EXTERNO,
        self::GARANTIA,
    ];
}

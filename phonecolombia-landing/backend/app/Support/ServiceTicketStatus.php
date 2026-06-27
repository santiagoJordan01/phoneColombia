<?php

namespace App\Support;

final class ServiceTicketStatus
{
    public const PROCESO_REVISION = 'proceso_revision';

    public const ESPERANDO_REPUESTOS = 'esperando_repuestos';

    public const SERVICIO_TECNICO = 'servicio_tecnico';

    public const SERVICIO_REALIZADO = 'servicio_realizado';

    public const ALL = [
        self::PROCESO_REVISION,
        self::ESPERANDO_REPUESTOS,
        self::SERVICIO_TECNICO,
        self::SERVICIO_REALIZADO,
    ];

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            self::PROCESO_REVISION => 'Proceso de revisión',
            self::ESPERANDO_REPUESTOS => 'Esperando repuestos',
            self::SERVICIO_TECNICO => 'Servicio técnico',
            self::SERVICIO_REALIZADO => 'Servicio realizado',
        ];
    }
}

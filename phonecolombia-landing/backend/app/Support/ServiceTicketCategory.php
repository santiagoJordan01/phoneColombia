<?php

namespace App\Support;

final class ServiceTicketCategory
{
    public const BATERIA = 'bateria';

    public const PANTALLA = 'pantalla';

    public const TAPA = 'tapa';

    public const CAMARA = 'camara';

    public const CARGA = 'carga';

    public const PORCENTAJE = 'porcentaje';

    public const REVISION = 'revision';

    public const OTRO = 'otro';

    public const ALL = [
        self::BATERIA,
        self::PANTALLA,
        self::TAPA,
        self::CAMARA,
        self::CARGA,
        self::PORCENTAJE,
        self::REVISION,
        self::OTRO,
    ];

    public const LABELS = [
        self::BATERIA => 'Batería',
        self::PANTALLA => 'Pantalla / visor',
        self::TAPA => 'Tapa / chasis',
        self::CAMARA => 'Cámara',
        self::CARGA => 'Puerto de carga',
        self::PORCENTAJE => 'Porcentaje / calibración',
        self::REVISION => 'Revisión / diagnóstico',
        self::OTRO => 'Otro',
    ];
}

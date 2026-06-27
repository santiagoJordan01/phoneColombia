<?php

namespace App\Support;

use App\Models\InventoryItem;
use App\Models\ServiceTicket;
use Illuminate\Validation\ValidationException;

final class InventoryStatusGuard
{
    /** @var list<string> */
    public const MANUAL_CREATE_STATUSES = [
        InventoryStatus::DISPONIBLE,
        InventoryStatus::SEPARADO,
    ];

    /** @var list<string> */
    public const SALE_ELIGIBLE_STATUSES = [
        InventoryStatus::DISPONIBLE,
        InventoryStatus::SEPARADO,
    ];

    public static function assertAllowedOnCreate(?string $status): void
    {
        $status = $status ?? InventoryStatus::DISPONIBLE;

        if (! in_array($status, self::MANUAL_CREATE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['Al ingresar un equipo solo puede quedar disponible o separado.'],
            ]);
        }
    }

    public static function assertManualTransition(InventoryItem $item, string $newStatus): void
    {
        $current = $item->status;

        if ($newStatus === $current) {
            return;
        }

        if ($newStatus === InventoryStatus::VENDIDO) {
            throw ValidationException::withMessages([
                'status' => ['Para marcar como vendido registre una venta.'],
            ]);
        }

        if ($newStatus === InventoryStatus::RETOMADO) {
            throw ValidationException::withMessages([
                'status' => ['Use la acción Retomar en equipos vendidos.'],
            ]);
        }

        if ($newStatus === InventoryStatus::SERVICIO_TECNICO) {
            throw ValidationException::withMessages([
                'status' => ['El estado servicio técnico se asigna al crear un ticket de ST.'],
            ]);
        }

        if ($current === InventoryStatus::VENDIDO) {
            throw ValidationException::withMessages([
                'status' => ['Un equipo vendido solo cambia con Retomar.'],
            ]);
        }

        if ($current === InventoryStatus::RETOMADO) {
            throw ValidationException::withMessages([
                'status' => ['Un equipo retomado solo reingresa con la acción Reingresar.'],
            ]);
        }

        if ($newStatus === InventoryStatus::DISPONIBLE) {
            if ($current === InventoryStatus::SERVICIO_TECNICO) {
                throw ValidationException::withMessages([
                    'status' => ['Cierre el ticket de servicio técnico para liberar el equipo.'],
                ]);
            }

            if (self::hasOpenServiceTicket($item)) {
                throw ValidationException::withMessages([
                    'status' => ['Hay un ticket de servicio técnico abierto para este equipo.'],
                ]);
            }
        }

        if ($newStatus === InventoryStatus::SEPARADO && $current !== InventoryStatus::DISPONIBLE) {
            throw ValidationException::withMessages([
                'status' => ['Solo equipos disponibles pueden marcarse como separados.'],
            ]);
        }

        if ($current === InventoryStatus::SERVICIO_TECNICO && $newStatus === InventoryStatus::SEPARADO) {
            throw ValidationException::withMessages([
                'status' => ['No puede apartar un equipo que está en servicio técnico.'],
            ]);
        }
    }

    public static function assertAvailableForSale(InventoryItem $item): void
    {
        if (! in_array($item->status, self::SALE_ELIGIBLE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'inventory_item_id' => ['El equipo no está disponible para venta.'],
            ]);
        }

        if (self::hasOpenServiceTicket($item)) {
            throw ValidationException::withMessages([
                'inventory_item_id' => ['El equipo tiene un ticket de servicio técnico abierto.'],
            ]);
        }
    }

    public static function assertAvailableForServiceTicket(InventoryItem $item): void
    {
        if (in_array($item->status, [InventoryStatus::VENDIDO, InventoryStatus::RETOMADO], true)) {
            throw ValidationException::withMessages([
                'inventory_item_id' => ['No puede ingresar a servicio técnico un equipo vendido o retomado.'],
            ]);
        }

        if (self::hasOpenServiceTicket($item)) {
            throw ValidationException::withMessages([
                'inventory_item_id' => ['Este equipo ya tiene un ticket de servicio técnico abierto.'],
            ]);
        }
    }

    public static function hasOpenServiceTicket(InventoryItem $item): bool
    {
        return ServiceTicket::query()
            ->where('inventory_item_id', $item->id)
            ->whereNull('delivered_at')
            ->exists();
    }
}

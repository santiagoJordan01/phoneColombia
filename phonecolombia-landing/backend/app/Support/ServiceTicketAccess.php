<?php

namespace App\Support;

use App\Models\ServiceTicket;
use App\Models\User;

final class ServiceTicketAccess
{
    public static function ticketAssignedToUser(ServiceTicket $ticket, User $user): bool
    {
        if ($ticket->assigned_user_id === $user->id) {
            return true;
        }

        return $user->service_technician_id !== null
            && $ticket->service_technician_id === $user->service_technician_id;
    }

    /** @param \Illuminate\Database\Eloquent\Builder<ServiceTicket> $query */
    public static function scopeForUser($query, User $user): void
    {
        if ($user->isServiceTechnician()) {
            $query->where(function ($q) use ($user) {
                $q->where('assigned_user_id', $user->id);
                if ($user->service_technician_id) {
                    $q->orWhere('service_technician_id', $user->service_technician_id);
                }
            });

            return;
        }

        if ($user->isSupplier() && $user->supplier_id) {
            $query->whereHas('inventoryItem', fn ($q) => $q->where('supplier_id', $user->supplier_id));
        }
    }
}

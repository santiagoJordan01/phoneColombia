<?php



namespace App\Http\Controllers\Concerns;



use App\Models\ServiceTicket;
use App\Models\User;



trait DeniesReadOnlyInventoryRoles

{

    protected function denyIfReadOnlyInventoryRole(User $user, string $action = 'modificar equipos'): void

    {

        if ($user->isSupplier() || $user->isAsesor() || $user->isServiceTechnician()) {

            abort(403, "No tienes permiso para {$action}.");

        }

    }



    protected function denyIfCannotManageCatalog(User $user): void

    {

        if (! $user->isSuperAdmin() && $user->resolvedRole() !== User::ROLE_INVENTORY) {

            abort(403, 'No tienes permiso para gestionar catálogos.');

        }

    }



    protected function denyIfCannotManageCustomers(User $user): void

    {

        if (! $user->canManageCustomers()) {

            abort(403, 'No tienes permiso para gestionar clientes.');

        }

    }



    protected function denyIfCannotCreateServiceTicket(User $user): void

    {

        if (! $user->canManageServiceTickets()) {

            abort(403, 'No tienes permiso para crear tickets de servicio técnico.');

        }

    }



    protected function denyIfCannotUpdateServiceTicket(User $user, ServiceTicket $ticket): void
    {
        if ($user->isServiceTechnician()) {
            abort(403, 'No tienes permiso para editar tickets de servicio técnico.');
        }

        if (! $user->canManageServiceTickets()) {
            abort(403, 'No tienes permiso para actualizar tickets de servicio técnico.');
        }
    }

}



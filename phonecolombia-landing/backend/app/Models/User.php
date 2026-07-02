<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_SUPER_ADMIN = 'super_admin';

    public const ROLE_CONTENT = 'content';

    public const ROLE_INVENTORY = 'inventory';

    public const ROLE_SELLER = 'seller';

    public const ROLE_ASESOR = 'asesor';

    public const ROLE_SERVICE_TECHNICIAN = 'service_technician';

    public const ROLE_SUPPLIER = 'supplier';

    public const ROLE_ACCOUNTANT = 'accountant';

    public const ROLES = [
        self::ROLE_SUPER_ADMIN,
        self::ROLE_CONTENT,
        self::ROLE_INVENTORY,
        self::ROLE_SELLER,
        self::ROLE_ASESOR,
        self::ROLE_SERVICE_TECHNICIAN,
        self::ROLE_SUPPLIER,
        self::ROLE_ACCOUNTANT,
    ];

    protected $fillable = [
        'name',
        'email',
        'password',
        'is_admin',
        'role',
        'supplier_id',
        'service_technician_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function serviceTechnician(): BelongsTo
    {
        return $this->belongsTo(ServiceTechnician::class);
    }

    public function resolvedRole(): ?string
    {
        if ($this->role) {
            return $this->role;
        }

        return $this->is_admin ? self::ROLE_SUPER_ADMIN : null;
    }

    public function hasPanelAccess(): bool
    {
        $role = $this->resolvedRole();

        if ($role === self::ROLE_CONTENT) {
            return false;
        }

        return in_array($role, self::ROLES, true);
    }

    public function isSuperAdmin(): bool
    {
        return $this->resolvedRole() === self::ROLE_SUPER_ADMIN;
    }

    public function isSeller(): bool
    {
        return $this->resolvedRole() === self::ROLE_SELLER;
    }

    public function isAsesor(): bool
    {
        return in_array($this->resolvedRole(), [self::ROLE_ASESOR, self::ROLE_SELLER], true);
    }

    public function isServiceTechnician(): bool
    {
        return $this->resolvedRole() === self::ROLE_SERVICE_TECHNICIAN;
    }

    public function isSupplier(): bool
    {
        return $this->resolvedRole() === self::ROLE_SUPPLIER;
    }

    public function isAccountant(): bool
    {
        return $this->resolvedRole() === self::ROLE_ACCOUNTANT;
    }

    public function canAccessContent(): bool
    {
        return $this->isSuperAdmin();
    }

    public function canAccessInventory(): bool
    {
        return in_array($this->resolvedRole(), [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_INVENTORY,
            self::ROLE_SELLER,
            self::ROLE_ASESOR,
            self::ROLE_SUPPLIER,
        ], true);
    }

    public function canAccessServiceTickets(): bool
    {
        return $this->canAccessInventory() || $this->isServiceTechnician();
    }

    public function canManageSales(): bool
    {
        return in_array($this->resolvedRole(), [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_INVENTORY,
            self::ROLE_SELLER,
            self::ROLE_ASESOR,
        ], true);
    }

    public function canManageCustomers(): bool
    {
        return $this->canManageSales();
    }

    public function canViewReports(): bool
    {
        return in_array($this->resolvedRole(), [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_INVENTORY,
            self::ROLE_SELLER,
            self::ROLE_ASESOR,
            self::ROLE_ACCOUNTANT,
        ], true);
    }

    public function canViewRemissions(): bool
    {
        return $this->canManageSales() || $this->isAccountant();
    }

    public function canManageServiceTickets(): bool
    {
        return in_array($this->resolvedRole(), [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_INVENTORY,
            self::ROLE_SELLER,
            self::ROLE_ASESOR,
        ], true);
    }

    public function canManageInventory(): bool
    {
        return in_array($this->resolvedRole(), [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_INVENTORY,
        ], true);
    }
}

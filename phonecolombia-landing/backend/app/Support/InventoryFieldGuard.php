<?php

namespace App\Support;

use App\Models\User;

final class InventoryFieldGuard
{
    public const RESTRICTED_FIELDS = ['imei', 'purchase_price', 'supplier', 'supplier_id', 'name', 'inventory_product_id'];

    public static function canViewField(User $user, string $field): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        if ($user->isSupplier()) {
            return ! in_array($field, ['purchase_price'], true);
        }

        if ($user->isSeller() || $user->isAsesor()) {
            return ! in_array($field, ['imei', 'purchase_price', 'supplier', 'supplier_id'], true);
        }

        if ($user->canAccessInventory()) {
            return true;
        }

        return false;
    }

    public static function canUpdateField(User $user, string $field): bool
    {
        if ($user->isSuperAdmin() || $user->resolvedRole() === User::ROLE_INVENTORY) {
            return true;
        }

        if (in_array($field, self::RESTRICTED_FIELDS, true)) {
            return false;
        }

        return $user->isSeller();
    }

    public static function filterItemArray(array $item, User $user): array
    {
        foreach (self::RESTRICTED_FIELDS as $field) {
            if (! self::canViewField($user, $field) && array_key_exists($field, $item)) {
                $item[$field] = null;
            }
        }

        return $item;
    }

    public static function stripRestrictedUpdates(array $data, User $user): array
    {
        foreach (self::RESTRICTED_FIELDS as $field) {
            if (array_key_exists($field, $data) && ! self::canUpdateField($user, $field)) {
                unset($data[$field]);
            }
        }

        return $data;
    }
}

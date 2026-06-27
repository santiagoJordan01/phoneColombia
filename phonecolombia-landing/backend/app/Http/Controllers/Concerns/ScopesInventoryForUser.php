<?php

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

trait ScopesInventoryForUser
{
    protected function scopeInventoryForUser(Builder $query, User $user): Builder
    {
        if ($user->isSuperAdmin()) {
            return $query;
        }

        if ($user->isSupplier() && $user->supplier_id) {
            return $query->where('supplier_id', $user->supplier_id);
        }

        return $query;
    }
}

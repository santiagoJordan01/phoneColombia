<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CreditSetting extends Model
{
    protected $fillable = [
        'billing_day',
    ];

    public static function current(): self
    {
        return static::query()->firstOrCreate([], ['billing_day' => 15]);
    }
}

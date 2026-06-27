<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ServiceTicketState extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'slug',
        'sort_order',
        'is_active',
        'is_default',
        'marks_in_service',
        'releases_inventory',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_default' => 'boolean',
            'marks_in_service' => 'boolean',
            'releases_inventory' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}

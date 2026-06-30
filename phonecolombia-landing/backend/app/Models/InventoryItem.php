<?php

namespace App\Models;

use App\Support\InventoryStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Support\SaleReservationStatus;

class InventoryItem extends Model
{
    use HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'inventory_product_id',
        'name',
        'sku',
        'imei',
        'barcode',
        'supplier',
        'supplier_id',
        'category',
        'condition',
        'storage',
        'color',
        'quantity',
        'purchase_price',
        'sale_price',
        'battery',
        'status',
        'notes',
        'acquired_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'acquired_at' => 'datetime',
        ];
    }

    public function inventoryProduct(): BelongsTo
    {
        return $this->belongsTo(InventoryProduct::class);
    }

    public function supplierRelation(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class)->orderByDesc('created_at');
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function activeReservation(): HasOne
    {
        return $this->hasOne(Sale::class)
            ->where('reservation_status', SaleReservationStatus::ACTIVE);
    }

    public function serviceTickets(): HasMany
    {
        return $this->hasMany(ServiceTicket::class);
    }

    public function isAvailableForSale(): bool
    {
        return in_array($this->status, [
            InventoryStatus::DISPONIBLE,
            InventoryStatus::SEPARADO,
        ], true);
    }
}

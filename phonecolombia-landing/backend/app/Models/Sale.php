<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'inventory_item_id',
        'user_id',
        'service_customer_id',
        'sale_price',
        'purchase_price_at_sale',
        'payment_method',
        'credit_payment_method_id',
        'credit_term_type',
        'credit_due_at',
        'credit_status',
        'amount_paid',
        'amount_due',
        'customer_name',
        'customer_phone',
        'notes',
        'sold_at',
    ];

    protected function casts(): array
    {
        return [
            'amount_paid' => 'decimal:2',
            'amount_due' => 'decimal:2',
            'sold_at' => 'datetime',
            'credit_due_at' => 'datetime',
        ];
    }

    public function creditPaymentMethod(): BelongsTo
    {
        return $this->belongsTo(CreditPaymentMethod::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function serviceCustomer(): BelongsTo
    {
        return $this->belongsTo(ServiceCustomer::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class);
    }
}

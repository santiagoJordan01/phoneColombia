<?php



namespace App\Models;



use Illuminate\Database\Eloquent\Concerns\HasUuids;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Relations\BelongsTo;



class ServiceTicket extends Model

{

    use HasUuids;



    public $incrementing = false;



    protected $keyType = 'string';



    protected $fillable = [

        'inventory_item_id',

        'service_customer_id',

        'ticket_type',

        'device_name',

        'device_reference',

        'assigned_user_id',

        'service_technician_id',

        'workshop',

        'created_by',

        'status',

        'issue_description',

        'service_category',

        'service_category_id',

        'repair_notes',

        'repair_cost',

        'customer_price',

        'is_warranty',

        'customer_name',

        'customer_phone',

        'received_at',

        'delivered_at',

    ];



    protected function casts(): array

    {

        return [

            'repair_cost' => 'decimal:2',

            'customer_price' => 'decimal:2',

            'is_warranty' => 'boolean',

            'received_at' => 'datetime',

            'delivered_at' => 'datetime',

        ];

    }



    public function inventoryItem(): BelongsTo

    {

        return $this->belongsTo(InventoryItem::class);

    }



    public function serviceCustomer(): BelongsTo

    {

        return $this->belongsTo(ServiceCustomer::class);

    }



    public function serviceCategory(): BelongsTo

    {

        return $this->belongsTo(ServiceCategory::class);

    }



    public function serviceTechnician(): BelongsTo

    {

        return $this->belongsTo(ServiceTechnician::class);

    }



    public function assignedUser(): BelongsTo

    {

        return $this->belongsTo(User::class, 'assigned_user_id');

    }



    public function creator(): BelongsTo

    {

        return $this->belongsTo(User::class, 'created_by');

    }



    public function hasInventoryItem(): bool

    {

        return $this->inventory_item_id !== null;

    }



    public function displayName(): string
    {
        return $this->inventoryItem?->name
            ?? $this->device_name
            ?? 'Equipo sin nombre';
    }

    public function isOpen(): bool
    {
        return $this->delivered_at === null;
    }
}



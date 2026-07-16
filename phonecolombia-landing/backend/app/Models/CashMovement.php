<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashMovement extends Model
{
    use HasUuids;

    public const TYPE_INGRESO = 'ingreso';

    public const TYPE_EGRESO = 'egreso';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'type',
        'method',
        'amount',
        'concept',
        'notes',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'occurred_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isIngreso(): bool
    {
        return $this->type === self::TYPE_INGRESO;
    }

    public function isEgreso(): bool
    {
        return $this->type === self::TYPE_EGRESO;
    }

    /** @return list<string> */
    public static function types(): array
    {
        return [self::TYPE_INGRESO, self::TYPE_EGRESO];
    }

    public static function typeLabel(string $type): string
    {
        return match ($type) {
            self::TYPE_INGRESO => 'Ingreso',
            self::TYPE_EGRESO => 'Egreso',
            default => $type,
        };
    }
}

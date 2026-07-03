<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryProduct extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'category',
        'brand',
        'model',
        'storage',
        'color',
        'reference_price',
        'notes',
    ];

    public function inventoryItems(): HasMany
    {
        return $this->hasMany(InventoryItem::class);
    }

    public static function findOrCreateFromParts(
        ?string $brand,
        string $model,
        ?string $storage,
        string $category = 'celular',
    ): self {
        $brand = $brand !== null && $brand !== '' ? strtoupper(trim($brand)) : null;
        $model = strtoupper(trim($model));
        $storage = $storage !== null && $storage !== '' ? strtoupper(trim($storage)) : null;

        $query = static::query()->where('model', $model);

        if ($brand) {
            $query->where('brand', $brand);
        } else {
            $query->where(function ($q) {
                $q->whereNull('brand')->orWhere('brand', '');
            });
        }

        if ($storage) {
            $query->where('storage', $storage);
        } else {
            $query->where(function ($q) {
                $q->whereNull('storage')->orWhere('storage', '');
            });
        }

        $existing = $query->first();
        if ($existing) {
            return $existing;
        }

        $name = strtoupper(trim(implode(' ', array_filter([$brand, $model, $storage]))));

        return static::create([
            'name' => $name,
            'brand' => $brand,
            'model' => $model,
            'storage' => $storage,
            'category' => $category,
            'color' => null,
        ]);
    }
}

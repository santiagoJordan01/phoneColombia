<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceCustomer extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'phone',
        'email',
        'document',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(ServiceTicket::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public static function findOrCreateFromContact(?string $name, ?string $phone): ?self
    {
        $name = self::normalizeName((string) ($name ?? ''));
        $phoneDigits = self::normalizePhoneDigits($phone);
        $phone = trim((string) ($phone ?? ''));

        if ($name === '' && $phoneDigits === '') {
            return null;
        }

        if ($phoneDigits !== '') {
            $byPhone = static::query()
                ->whereNotNull('phone')
                ->get()
                ->first(fn (self $customer) => self::normalizePhoneDigits($customer->phone) === $phoneDigits);

            if ($byPhone) {
                return self::mergeContact($byPhone, $name, $phone);
            }
        }

        if ($name !== '') {
            $byName = static::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->first();

            if ($byName) {
                return self::mergeContact($byName, $name, $phone);
            }
        }

        if ($name === '') {
            return null;
        }

        return static::create([
            'name' => $name,
            'phone' => $phone !== '' ? $phone : null,
            'is_active' => true,
        ]);
    }

    private static function mergeContact(self $customer, string $name, string $phone): self
    {
        $updates = [];

        if ($phone !== '' && trim((string) $customer->phone) === '') {
            $updates['phone'] = $phone;
        }

        if ($updates !== []) {
            $customer->update($updates);
        }

        return $customer->fresh();
    }

    private static function normalizeName(string $name): string
    {
        return trim(preg_replace('/\s+/u', ' ', $name) ?? '');
    }

    private static function normalizePhoneDigits(?string $phone): string
    {
        if ($phone === null || $phone === '') {
            return '';
        }

        return preg_replace('/\D+/', '', $phone) ?? '';
    }
}

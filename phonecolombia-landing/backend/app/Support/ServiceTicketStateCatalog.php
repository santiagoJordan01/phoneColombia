<?php

namespace App\Support;

use App\Models\ServiceTicketState;
use Illuminate\Support\Collection;

final class ServiceTicketStateCatalog
{
    /** @return Collection<int, ServiceTicketState> */
    public static function active(): Collection
    {
        return ServiceTicketState::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    /** @return array<string, string> slug => name */
    public static function labelsMap(bool $activeOnly = true): array
    {
        $query = ServiceTicketState::query()->orderBy('sort_order')->orderBy('name');
        if ($activeOnly) {
            $query->where('is_active', true);
        }

        return $query->pluck('name', 'slug')->all();
    }

    /** @return list<string> */
    public static function activeSlugs(): array
    {
        return self::active()->pluck('slug')->all();
    }

    public static function defaultSlug(): string
    {
        $default = ServiceTicketState::query()
            ->where('is_active', true)
            ->where('is_default', true)
            ->orderBy('sort_order')
            ->value('slug');

        if ($default) {
            return $default;
        }

        return ServiceTicketState::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->value('slug') ?? ServiceTicketStatus::PROCESO_REVISION;
    }

    public static function findBySlug(?string $slug): ?ServiceTicketState
    {
        if (! $slug) {
            return null;
        }

        return ServiceTicketState::query()->where('slug', $slug)->first();
    }
}

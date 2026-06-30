<?php

namespace App\Support;

use App\Models\Sale;

final class RemissionNumberGenerator
{
    public static function next(): string
    {
        $year = (int) now()->format('Y');
        $prefix = "R-{$year}-";

        $lastNumber = Sale::query()
            ->where('remission_number', 'like', $prefix.'%')
            ->lockForUpdate()
            ->orderByDesc('remission_number')
            ->value('remission_number');

        $nextSeq = 1;
        if ($lastNumber && preg_match('/-(\d+)$/', $lastNumber, $matches)) {
            $nextSeq = ((int) $matches[1]) + 1;
        }

        return sprintf('R-%d-%06d', $year, $nextSeq);
    }
}

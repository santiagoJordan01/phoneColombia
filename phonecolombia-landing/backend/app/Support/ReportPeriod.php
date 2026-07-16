<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

final class ReportPeriod
{
    public const TIMEZONE = 'America/Bogota';

    /**
     * Resolve a report date range using Colombia local calendar days.
     *
     * Query bounds are converted to the app timezone (UTC) so MySQL datetime
     * comparisons match how sold_at / paid_at are stored.
     *
     * @return array{0: Carbon, 1: Carbon, 2: Carbon, 3: Carbon} [$periodStartUtc, $periodEndUtc, $from, $to]
     */
    public static function resolve(Request $request): array
    {
        $tz = self::TIMEZONE;
        $toInput = $request->input('to') ?? $request->input('date');
        $fromInput = $request->input('from') ?? $toInput;

        $to = $toInput
            ? Carbon::parse($toInput, $tz)->startOfDay()
            : now($tz)->startOfDay();
        $from = $fromInput
            ? Carbon::parse($fromInput, $tz)->startOfDay()
            : $to->copy();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        return self::packBounds($from, $to);
    }

    /**
     * Same as resolve(), but defaults to the current month through today.
     *
     * @return array{0: Carbon, 1: Carbon, 2: Carbon, 3: Carbon}
     */
    public static function resolveMonthToDate(Request $request): array
    {
        $tz = self::TIMEZONE;
        $now = now($tz);

        $to = $request->filled('to')
            ? Carbon::parse($request->input('to'), $tz)->startOfDay()
            : $now->copy()->startOfDay();
        $from = $request->filled('from')
            ? Carbon::parse($request->input('from'), $tz)->startOfDay()
            : $now->copy()->startOfMonth()->startOfDay();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        return self::packBounds($from, $to);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    public static function monthBounds(int $year, int $month): array
    {
        $start = Carbon::create($year, $month, 1, 0, 0, 0, self::TIMEZONE)->startOfDay();
        $end = $start->copy()->endOfMonth()->endOfDay();

        return [
            self::toAppTimezone($start),
            self::toAppTimezone($end),
        ];
    }

    /**
     * @return array{0: Carbon, 1: Carbon, 2: Carbon, 3: Carbon}
     */
    private static function packBounds(Carbon $from, Carbon $to): array
    {
        return [
            self::toAppTimezone($from->copy()->startOfDay()),
            self::toAppTimezone($to->copy()->endOfDay()),
            $from,
            $to,
        ];
    }

    private static function toAppTimezone(Carbon $value): Carbon
    {
        return $value->copy()->timezone(config('app.timezone') ?: 'UTC');
    }
}

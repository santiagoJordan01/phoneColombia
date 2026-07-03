<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Informe de ventas — {{ $dateLabel }}</title>
    @include('reports.partials.pdf-styles')
</head>
<body>
    @php
        use App\Support\MoneyFormatter;

        $totals = $report['totals'] ?? [];
        $sales = collect($report['sales'] ?? []);
        $byMethod = $report['totals']['by_method'] ?? [];
        $isRange = $report['is_range'] ?? false;

        use App\Support\PaymentMethods;

        $paymentLabels = PaymentMethods::labels();
        $paymentLabel = fn ($method) => $paymentLabels[$method] ?? ($method ?: '—');

        $formatMargin = function ($value) {
            if ($value === null || $value === '') {
                return '—';
            }

            return number_format((float) $value, 1, ',', '.').'%';
        };

        $kpis = [
            ['label' => 'Ventas', 'value' => (string) ($totals['count'] ?? 0), 'tone' => 'blue'],
            ['label' => 'Ingresos', 'value' => MoneyFormatter::format($totals['revenue'] ?? 0), 'tone' => 'purple'],
            ['label' => 'Costo total', 'value' => MoneyFormatter::format($totals['cost'] ?? 0), 'tone' => 'slate'],
            ['label' => 'Utilidad bruta', 'value' => MoneyFormatter::format($totals['profit'] ?? 0), 'tone' => 'green'],
            ['label' => 'Margen', 'value' => $formatMargin($totals['margin_percent'] ?? null), 'tone' => 'amber'],
            ['label' => 'Pagado (ventas)', 'value' => MoneyFormatter::format($totals['collected'] ?? 0), 'tone' => 'green'],
        ];
        if (($totals['pending'] ?? 0) > 0) {
            $kpis[] = ['label' => 'Pendiente', 'value' => MoneyFormatter::format($totals['pending']), 'tone' => 'orange'];
        }
        if (($totals['collected_in_period'] ?? null) !== null) {
            $kpis[] = ['label' => 'Cobros del período', 'value' => MoneyFormatter::format($totals['collected_in_period']), 'tone' => 'blue'];
        }
    @endphp

    @include('reports.partials.pdf-header', [
        'docLabel' => 'Informe de ventas',
        'docSubtitle' => $isRange ? 'Período múltiple' : 'Corte diario',
        'periodLabel' => $periodLabel,
        'generatedAt' => $generatedAt,
    ])

    @include('reports.partials.pdf-kpis', ['kpis' => $kpis])
    @include('reports.partials.pdf-methodology', ['text' => $report['methodology'] ?? null])

    @if ($sales->isEmpty())
        <p class="empty">No hay ventas registradas para este período con los filtros aplicados.</p>
    @else
        <div class="section">
            <p class="section-title">Detalle de ventas</p>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>{{ $isRange ? 'Fecha' : 'Hora' }}</th>
                        <th>Remisión</th>
                        <th>Equipo</th>
                        <th>IMEI</th>
                        <th class="num">Venta</th>
                        <th class="num">Costo</th>
                        <th class="num">Utilidad</th>
                        <th class="num">Pagado</th>
                        <th class="num">Pendiente</th>
                        <th>Método</th>
                        <th>Vendedor</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($sales as $sale)
                        @php
                            $soldAt = $sale['sold_at'] ?? null;
                            $time = $soldAt
                                ? ($isRange
                                    ? \Carbon\Carbon::parse($soldAt)->timezone('America/Bogota')->format('d/m/Y H:i')
                                    : \Carbon\Carbon::parse($soldAt)->timezone('America/Bogota')->format('H:i'))
                                : '—';
                        @endphp
                        <tr>
                            <td>{{ $time }}</td>
                            <td>{{ $sale['remission_number'] ?? '—' }}</td>
                            <td>{{ $sale['item'] ?? '—' }}</td>
                            <td>{{ $sale['imei'] ?? $sale['barcode'] ?? '—' }}</td>
                            <td class="num">{{ MoneyFormatter::format($sale['sale_price_num'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($sale['purchase_price_num'] ?? 0) }}</td>
                            <td class="num num--profit">{{ MoneyFormatter::format($sale['net_profit'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($sale['amount_paid'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($sale['amount_due'] ?? 0) }}</td>
                            <td>{{ $paymentLabel($sale['payment_method'] ?? null) }}</td>
                            <td>{{ $sale['seller'] ?? '—' }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4">Totales ({{ $totals['count'] ?? $sales->count() }})</td>
                        <td class="num">{{ MoneyFormatter::format($totals['revenue'] ?? 0) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['cost'] ?? 0) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['profit'] ?? 0) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['collected'] ?? 0) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['pending'] ?? 0) }}</td>
                        <td colspan="2"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    @endif

    @if (is_array($byMethod) && count($byMethod) > 0)
        <div class="section">
            <p class="section-title">Cobros del período por método (fecha de pago)</p>
            <table class="data-table data-table--compact">
                <thead>
                    <tr>
                        <th>Método</th>
                        <th class="num">Monto</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($byMethod as $method => $amount)
                        <tr>
                            <td>{{ $paymentLabel($method) }}</td>
                            <td class="num">{{ MoneyFormatter::format($amount) }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>Total cobrado</td>
                        <td class="num">{{ MoneyFormatter::format($totals['collected_in_period'] ?? array_sum(array_map('floatval', $byMethod))) }}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    @endif

    @include('reports.partials.pdf-footer')
</body>
</html>

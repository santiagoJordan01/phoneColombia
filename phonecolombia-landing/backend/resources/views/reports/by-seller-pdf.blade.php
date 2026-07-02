<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Informe por vendedor — {{ $dateLabel }}</title>
    @include('reports.partials.pdf-styles')
</head>
<body>
    @php
        use App\Support\MoneyFormatter;

        $totals = $report['totals'] ?? [];
        $sellers = collect($report['sellers'] ?? []);

        $paymentLabels = [
            'efectivo' => 'Efectivo',
            'transferencia' => 'Transferencia',
            'credito' => 'Crédito',
            'mixto' => 'Mixto',
        ];
        $paymentLabel = fn ($method) => $paymentLabels[$method] ?? ($method ?: '—');

        $formatMargin = function ($value) {
            if ($value === null || $value === '') {
                return '—';
            }

            return number_format((float) $value, 1, ',', '.').'%';
        };

        $sellerCount = $sellers->count();
        $kpis = [
            ['label' => 'Ventas', 'value' => (string) ($totals['count'] ?? 0), 'tone' => 'blue'],
            ['label' => 'Ingresos', 'value' => MoneyFormatter::format($totals['revenue'] ?? 0), 'tone' => 'purple'],
            ['label' => 'Costo total', 'value' => MoneyFormatter::format($totals['cost'] ?? 0), 'tone' => 'slate'],
            ['label' => 'Utilidad bruta', 'value' => MoneyFormatter::format($totals['profit'] ?? 0), 'tone' => 'green'],
            ['label' => 'Margen', 'value' => $formatMargin($totals['margin_percent'] ?? null), 'tone' => 'amber'],
            ['label' => 'Recaudado', 'value' => MoneyFormatter::format($totals['collected'] ?? 0), 'tone' => 'green'],
        ];
        if (($totals['pending'] ?? 0) > 0) {
            $kpis[] = ['label' => 'Pendiente', 'value' => MoneyFormatter::format($totals['pending']), 'tone' => 'orange'];
        }
    @endphp

    @include('reports.partials.pdf-header', [
        'docLabel' => 'Informe por vendedor',
        'docSubtitle' => $sellerCount.' vendedor'.($sellerCount === 1 ? '' : 'es').' en el período',
        'periodLabel' => $periodLabel,
        'generatedAt' => $generatedAt,
    ])

    @include('reports.partials.pdf-kpis', ['kpis' => $kpis])
    @include('reports.partials.pdf-methodology', ['text' => $report['methodology'] ?? null])

    @if ($sellers->isEmpty())
        <p class="empty">No hay ventas por vendedor en este período con los filtros aplicados.</p>
    @else
        <div class="section">
            <p class="section-title">Resumen por vendedor</p>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Vendedor</th>
                        <th class="num">Ventas</th>
                        <th class="num">Ingresos</th>
                        <th class="num">Costo</th>
                        <th class="num">Utilidad</th>
                        <th class="num">Margen</th>
                        <th class="num">Recaudado</th>
                        <th class="num">Pendiente</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($sellers as $group)
                        <tr>
                            <td class="seller-name">{{ $group['seller'] ?? 'Sin vendedor' }}</td>
                            <td class="num">{{ $group['count'] ?? 0 }}</td>
                            <td class="num">{{ MoneyFormatter::format($group['revenue'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($group['cost'] ?? 0) }}</td>
                            <td class="num num--profit">{{ MoneyFormatter::format($group['profit'] ?? 0) }}</td>
                            <td class="num">{{ $formatMargin($group['margin_percent'] ?? null) }}</td>
                            <td class="num">{{ MoneyFormatter::format($group['collected'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($group['pending'] ?? 0) }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>Total general</td>
                        <td class="num">{{ $totals['count'] ?? 0 }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['revenue'] ?? 0) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['cost'] ?? 0) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['profit'] ?? 0) }}</td>
                        <td class="num">{{ $formatMargin($totals['margin_percent'] ?? null) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['collected'] ?? 0) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['pending'] ?? 0) }}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div class="section">
            <p class="section-title">Detalle por vendedor</p>
            @foreach ($sellers as $index => $group)
                @if ($index > 0)
                    <div class="page-break"></div>
                @endif
                <div class="seller-block">
                    <p class="seller-block__name">{{ $group['seller'] ?? 'Sin vendedor' }}</p>
                    <p class="seller-block__meta">
                        {{ $group['count'] ?? 0 }} ventas ·
                        Ingresos {{ MoneyFormatter::format($group['revenue'] ?? 0) }} ·
                        Utilidad {{ MoneyFormatter::format($group['profit'] ?? 0) }}
                        @if (($group['margin_percent'] ?? null) !== null)
                            · Margen {{ $formatMargin($group['margin_percent']) }}
                        @endif
                    </p>
                    @php $sales = collect($group['sales'] ?? []); @endphp
                    @if ($sales->isEmpty())
                        <p class="empty">Sin ventas.</p>
                    @else
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Equipo</th>
                                    <th>IMEI</th>
                                    <th class="num">Precio venta</th>
                                    <th class="num">Costo</th>
                                    <th class="num">Utilidad</th>
                                    <th class="num">Pagado</th>
                                    <th class="num">Pendiente</th>
                                    <th>Método</th>
                                    <th>Cliente</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($sales as $sale)
                                    @php
                                        $soldAt = $sale['sold_at'] ?? null;
                                        $when = $soldAt
                                            ? \Carbon\Carbon::parse($soldAt)->timezone('America/Bogota')->format('d/m/Y H:i')
                                            : '—';
                                    @endphp
                                    <tr>
                                        <td>{{ $when }}</td>
                                        <td>{{ $sale['item'] ?? '—' }}</td>
                                        <td>{{ $sale['imei'] ?? $sale['barcode'] ?? '—' }}</td>
                                        <td class="num">{{ MoneyFormatter::format($sale['sale_price_num'] ?? 0) }}</td>
                                        <td class="num">{{ MoneyFormatter::format($sale['purchase_price_num'] ?? 0) }}</td>
                                        <td class="num num--profit">{{ MoneyFormatter::format($sale['net_profit'] ?? 0) }}</td>
                                        <td class="num">{{ MoneyFormatter::format($sale['amount_paid'] ?? 0) }}</td>
                                        <td class="num">{{ MoneyFormatter::format($sale['amount_due'] ?? 0) }}</td>
                                        <td>{{ $paymentLabel($sale['payment_method'] ?? null) }}</td>
                                        <td>{{ $sale['customer'] ?? '—' }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3">Subtotal ({{ $group['count'] ?? $sales->count() }})</td>
                                    <td class="num">{{ MoneyFormatter::format($group['revenue'] ?? 0) }}</td>
                                    <td class="num">{{ MoneyFormatter::format($group['cost'] ?? 0) }}</td>
                                    <td class="num">{{ MoneyFormatter::format($group['profit'] ?? 0) }}</td>
                                    <td class="num">{{ MoneyFormatter::format($group['collected'] ?? 0) }}</td>
                                    <td class="num">{{ MoneyFormatter::format($group['pending'] ?? 0) }}</td>
                                    <td colspan="2"></td>
                                </tr>
                            </tfoot>
                        </table>
                    @endif
                </div>
            @endforeach
        </div>
    @endif

    @include('reports.partials.pdf-footer')
</body>
</html>

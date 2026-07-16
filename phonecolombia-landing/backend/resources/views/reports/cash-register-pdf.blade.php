<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Libro de caja — {{ $dateLabel }}</title>
    @include('reports.partials.pdf-styles')
    <style>
        .data-table--ledger { font-size: 7.5px; }
        .data-table--ledger th { font-size: 6.5px; padding: 4px 5px; }
        .data-table--ledger td { font-size: 7.5px; padding: 4px 5px; }
        .amount-out { color: #b45309; font-weight: bold; }
        .amount-in { color: #047857; font-weight: bold; }
        .type-grid { width: 100%; border-collapse: separate; border-spacing: 5px 5px; margin: 0 -5px 10px; }
        .type-grid td { width: 25%; vertical-align: top; padding: 0; }
        .type-card {
            border: 1px solid #e2e8f0;
            border-top: 3px solid #64748b;
            border-radius: 5px;
            padding: 6px 8px;
            background: #fff;
        }
        .type-card__label { font-size: 6.5px; font-weight: bold; text-transform: uppercase; color: #64748b; }
        .type-card__value { font-size: 9px; font-weight: bold; color: #0f172a; }
    </style>
</head>
<body>
    @php
        use App\Support\MoneyFormatter;
        use App\Support\PaymentMethods;

        $paymentLabels = PaymentMethods::labels();
        $collectionLabels = [
            'venta' => 'Cobro venta',
            'apartado' => 'Abono apartado',
            'abono' => 'Abono crédito',
            'retoma' => 'Pago retoma',
            'otro' => 'Cobro',
        ];
        $paymentLabel = fn ($method) => $paymentLabels[$method] ?? ($method ?: '—');
        $collectionLabel = fn ($type) => $collectionLabels[$type] ?? ($type ?: '—');

        $isRange = $report['is_range'] ?? false;
        $ledger = collect($report['ledger'] ?? []);
        $byMethod = $report['by_payment_method'] ?? [];
        $byType = $report['by_collection_type'] ?? [];

        $kpis = [
            ['label' => 'Ventas del período', 'value' => (string) ($report['sales_count'] ?? 0), 'tone' => 'blue'],
            ['label' => 'Ingresos (ventas)', 'value' => MoneyFormatter::format($report['total_expected'] ?? 0), 'tone' => 'purple'],
            ['label' => 'Cobrado en período', 'value' => MoneyFormatter::format($report['cash_collected_in_period'] ?? $report['total_collected'] ?? 0), 'tone' => 'green'],
            ['label' => 'Pendiente (ventas)', 'value' => MoneyFormatter::format($report['pending_credits'] ?? 0), 'tone' => 'amber'],
            ['label' => 'Conciliación ventas', 'value' => MoneyFormatter::format($report['difference'] ?? 0), 'tone' => 'slate'],
            ['label' => 'Costo total', 'value' => MoneyFormatter::format($report['total_cost'] ?? 0), 'tone' => 'slate'],
            ['label' => 'Utilidad bruta', 'value' => MoneyFormatter::format($report['total_profit'] ?? 0), 'tone' => 'green'],
            ['label' => 'Margen', 'value' => ($report['margin_percent'] ?? null) !== null ? ($report['margin_percent'].'%') : '—', 'tone' => 'amber'],
            ['label' => 'Cobros ventas período', 'value' => MoneyFormatter::format($report['collections_on_period_sales'] ?? 0), 'tone' => 'green'],
            ['label' => 'Apartados/abonos previos', 'value' => MoneyFormatter::format($report['collections_on_other_sales'] ?? 0), 'tone' => 'purple'],
        ];
        if (($report['retake_outflows'] ?? 0) > 0) {
            $kpis[] = ['label' => 'Pagos retoma', 'value' => MoneyFormatter::format(-1 * abs($report['retake_outflows'])), 'tone' => 'orange'];
        }
    @endphp

    @include('reports.partials.pdf-header', [
        'docLabel' => 'Libro de caja',
        'docSubtitle' => $isRange ? 'Período múltiple' : 'Cobros y retomas del día',
        'periodLabel' => $periodLabel,
        'generatedAt' => $generatedAt,
    ])

    @include('reports.partials.pdf-kpis', ['kpis' => $kpis])
    @include('reports.partials.pdf-methodology', ['text' => $report['methodology'] ?? null])

    @if (count($byType) > 0)
        <div class="section">
            <p class="section-title">Movimientos por tipo</p>
            @php $typeRows = array_chunk($byType, 4, true); @endphp
            @foreach ($typeRows as $typeRow)
                <table class="type-grid">
                    <tr>
                        @foreach ($typeRow as $type => $amount)
                            <td>
                                <div class="type-card">
                                    <span class="type-card__label">{{ $collectionLabel($type) }}</span><br>
                                    <span class="type-card__value">{{ MoneyFormatter::format($amount) }}</span>
                                </div>
                            </td>
                        @endforeach
                        @for ($i = count($typeRow); $i < 4; $i++)
                            <td></td>
                        @endfor
                    </tr>
                </table>
            @endforeach
        </div>
    @endif

    @if (count($byMethod) > 0)
        <div class="section">
            <p class="section-title">Neto del período por método</p>
            <table class="data-table data-table--compact">
                <thead>
                    <tr>
                        <th>Método</th>
                        <th class="num">Neto</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($byMethod as $method => $amount)
                        <tr>
                            <td>{{ $paymentLabel($method) }}</td>
                            <td class="num {{ $amount < 0 ? 'amount-out' : 'amount-in' }}">{{ MoneyFormatter::format($amount) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif

    <div class="section">
        <p class="section-title">Libro de cobros y retomas</p>
        @if ($ledger->isEmpty())
            <p class="empty">No hay movimientos de caja en este período.</p>
        @else
            <table class="data-table data-table--ledger">
                <thead>
                    <tr>
                        <th>{{ $isRange ? 'Fecha' : 'Hora' }}</th>
                        <th>Remisión</th>
                        <th>Tipo</th>
                        <th>Equipo</th>
                        <th>Cliente</th>
                        <th>Método</th>
                        <th class="num">Monto</th>
                        <th>Vendedor</th>
                        <th>Notas</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($ledger as $line)
                        @php
                            $paidAt = $line['paid_at'] ?? null;
                            $when = $paidAt
                                ? ($isRange
                                    ? \Carbon\Carbon::parse($paidAt)->timezone('America/Bogota')->format('d/m/Y H:i')
                                    : \Carbon\Carbon::parse($paidAt)->timezone('America/Bogota')->format('H:i'))
                                : '—';
                            $amount = (float) ($line['amount'] ?? 0);
                        @endphp
                        <tr>
                            <td>{{ $when }}</td>
                            <td>{{ $line['remission_number'] ?? '—' }}</td>
                            <td>{{ $line['type_label'] ?? $collectionLabel($line['type'] ?? '') }}</td>
                            <td>{{ $line['item'] ?? '—' }}</td>
                            <td>{{ $line['customer'] ?? '—' }}</td>
                            <td>{{ $paymentLabel($line['method'] ?? '') }}</td>
                            <td class="num {{ $amount < 0 ? 'amount-out' : 'amount-in' }}">{{ MoneyFormatter::format($amount) }}</td>
                            <td>{{ $line['seller'] ?? '—' }}</td>
                            <td>{{ $line['notes'] ?? '—' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    </div>

    @include('reports.partials.pdf-footer')
</body>
</html>

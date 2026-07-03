<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Informe por remisión — {{ $dateLabel }}</title>
    @include('reports.partials.pdf-styles')
</head>
<body>
    @php
        use App\Support\MoneyFormatter;

        $totals = $report['totals'] ?? [];
        $remissions = collect($report['remissions'] ?? []);
        $showDate = ! empty($report['is_range']);

        use App\Support\PaymentMethods;

        $paymentLabels = PaymentMethods::labels();
        $paymentLabel = fn ($method) => $paymentLabels[$method] ?? ($method ?: '—');

        $formatDateTime = function ($value) use ($showDate) {
            if (! $value) {
                return '—';
            }

            try {
                $date = \Illuminate\Support\Carbon::parse($value)->timezone('America/Bogota');

                return $showDate
                    ? $date->format('d/m/Y H:i')
                    : $date->format('H:i');
            } catch (\Throwable) {
                return (string) $value;
            }
        };

        $kpis = [
            ['label' => 'Remisiones', 'value' => (string) ($totals['count'] ?? 0), 'tone' => 'blue'],
            ['label' => 'Ingresos', 'value' => MoneyFormatter::format($totals['revenue'] ?? 0), 'tone' => 'purple'],
            ['label' => 'Pagado', 'value' => MoneyFormatter::format($totals['collected'] ?? 0), 'tone' => 'green'],
        ];
        if (($totals['pending'] ?? 0) > 0) {
            $kpis[] = ['label' => 'Pendiente', 'value' => MoneyFormatter::format($totals['pending']), 'tone' => 'orange'];
        }
        $kpis[] = ['label' => 'Costo total', 'value' => MoneyFormatter::format($totals['cost'] ?? 0), 'tone' => 'slate'];
        $kpis[] = ['label' => 'Utilidad bruta', 'value' => MoneyFormatter::format($totals['profit'] ?? 0), 'tone' => 'green'];
        if (($totals['margin_percent'] ?? null) !== null) {
            $kpis[] = ['label' => 'Margen', 'value' => ($totals['margin_percent'] ?? 0).'%', 'tone' => 'amber'];
        }
        $kpis[] = ['label' => 'Entregadas', 'value' => (string) ($totals['entregados'] ?? 0), 'tone' => 'slate'];
        $kpis[] = ['label' => 'Apartados', 'value' => (string) ($totals['apartados'] ?? 0), 'tone' => 'purple'];
    @endphp

    @include('reports.partials.pdf-header', [
        'docLabel' => 'Informe por remisión',
        'docSubtitle' => ($totals['count'] ?? 0).' remisión'.(($totals['count'] ?? 0) === 1 ? '' : 'es').' en el período',
        'periodLabel' => $periodLabel,
        'generatedAt' => $generatedAt,
    ])

    @include('reports.partials.pdf-kpis', ['kpis' => $kpis])
    @include('reports.partials.pdf-methodology', ['text' => $report['methodology'] ?? null])

    @if ($remissions->isEmpty())
        <p class="empty">No hay remisiones en este período con los filtros aplicados.</p>
    @else
        <div class="section">
            <p class="section-title">Detalle por remisión</p>
            @foreach ($remissions as $index => $rem)
                @if ($index > 0)
                    <div class="page-break"></div>
                @endif
                <div class="seller-block">
                    <p class="seller-block__name mono">{{ $rem['remission_number'] ?? '—' }} · {{ $rem['status_label'] ?? ($rem['status'] ?? '—') }}</p>
                    <p class="seller-block__meta">
                        {{ $formatDateTime($rem['document_date'] ?? null) }}
                        @if (! empty($rem['customer']))
                            · {{ $rem['customer'] }}
                        @endif
                        @if (! empty($rem['customer_phone']))
                            · {{ $rem['customer_phone'] }}
                        @endif
                        @if (! empty($rem['seller']))
                            · {{ $rem['seller'] }}
                        @endif
                    </p>

                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Equipo</th>
                                <th>IMEI</th>
                                <th class="num">Precio venta</th>
                                <th class="num">Costo</th>
                                <th class="num">Utilidad</th>
                                <th class="num">Pagado</th>
                                <th class="num">Pendiente</th>
                                <th>Método</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{{ $rem['item'] ?? '—' }}</td>
                                <td class="mono">{{ $rem['imei'] ?? ($rem['barcode'] ?? '—') }}</td>
                                <td class="num">{{ MoneyFormatter::format($rem['sale_price_num'] ?? ($rem['sale_price'] ?? 0)) }}</td>
                                <td class="num">{{ MoneyFormatter::format($rem['purchase_price_num'] ?? 0) }}</td>
                                <td class="num num--profit">{{ MoneyFormatter::format($rem['net_profit'] ?? 0) }}</td>
                                <td class="num">{{ MoneyFormatter::format($rem['amount_paid'] ?? 0) }}</td>
                                <td class="num">{{ MoneyFormatter::format($rem['amount_due'] ?? 0) }}</td>
                                <td>
                                    {{ $paymentLabel($rem['payment_method'] ?? null) }}
                                    @if (! empty($rem['credit_payment_method']))
                                        · {{ $rem['credit_payment_method'] }}
                                    @endif
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    @php $payments = collect($rem['payments'] ?? []); @endphp
                    @if ($payments->isNotEmpty())
                        <p class="seller-block__meta" style="font-weight: 600; margin-top: 8px;">Pagos de la remisión</p>
                        <table class="data-table data-table--compact">
                            <thead>
                                <tr>
                                    <th>{{ $showDate ? 'Fecha' : 'Hora' }}</th>
                                    <th>Método</th>
                                    <th class="num">Monto</th>
                                    <th>Notas</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($payments as $payment)
                                    <tr>
                                        <td>{{ $formatDateTime($payment['paid_at'] ?? null) }}</td>
                                        <td>{{ $payment['method_label'] ?? $paymentLabel($payment['method'] ?? null) }}</td>
                                        <td class="num">{{ MoneyFormatter::format($payment['amount'] ?? 0) }}</td>
                                        <td>{{ $payment['notes'] ?? '—' }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    @else
                        <p class="empty">Sin pagos registrados.</p>
                    @endif

                    @if (! empty($rem['notes']))
                        <p class="seller-block__meta"><strong>Notas:</strong> {{ $rem['notes'] }}</p>
                    @endif
                </div>
            @endforeach
        </div>
    @endif

    @include('reports.partials.pdf-footer')
</body>
</html>

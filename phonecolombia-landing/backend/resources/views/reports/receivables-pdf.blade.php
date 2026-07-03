<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Informe de cartera — {{ $dateLabel }}</title>
    @include('reports.partials.pdf-styles')
    <style>
        .status-overdue { color: #b45309; font-weight: bold; }
        .status-ok { color: #047857; }
    </style>
</head>
<body>
    @php
        use App\Support\MoneyFormatter;

        $totals = $report['totals'] ?? [];
        $items = collect($report['items'] ?? []);

        $kpis = [
            ['label' => 'Cuentas con saldo', 'value' => (string) ($totals['count'] ?? 0), 'tone' => 'blue'],
            ['label' => 'Pendiente total', 'value' => MoneyFormatter::format($totals['total_due'] ?? 0), 'tone' => 'amber'],
            ['label' => 'Total pagado', 'value' => MoneyFormatter::format($totals['total_paid'] ?? 0), 'tone' => 'green'],
            ['label' => 'Apartados', 'value' => (string) ($totals['apartados_count'] ?? 0), 'tone' => 'purple'],
            ['label' => 'Saldo apartados', 'value' => MoneyFormatter::format($totals['apartados_due'] ?? 0), 'tone' => 'purple'],
            ['label' => 'Créditos', 'value' => (string) ($totals['creditos_count'] ?? 0), 'tone' => 'slate'],
            ['label' => 'Saldo créditos', 'value' => MoneyFormatter::format($totals['creditos_due'] ?? 0), 'tone' => 'slate'],
        ];
        if (($totals['overdue_count'] ?? 0) > 0) {
            $kpis[] = ['label' => 'Vencidos ('.($totals['overdue_count'] ?? 0).')', 'value' => MoneyFormatter::format($totals['overdue_amount'] ?? 0), 'tone' => 'orange'];
        }
        $kpis[] = ['label' => 'Valor ventas', 'value' => MoneyFormatter::format($totals['revenue'] ?? 0), 'tone' => 'purple'];
        $kpis[] = ['label' => 'Costo total', 'value' => MoneyFormatter::format($totals['total_cost'] ?? 0), 'tone' => 'slate'];
        $kpis[] = ['label' => 'Utilidad bruta', 'value' => MoneyFormatter::format($totals['total_profit'] ?? 0), 'tone' => 'green'];
        if (($totals['margin_percent'] ?? null) !== null) {
            $kpis[] = ['label' => 'Margen', 'value' => ($totals['margin_percent'] ?? 0).'%', 'tone' => 'amber'];
        }
    @endphp

    @include('reports.partials.pdf-header', [
        'docLabel' => 'Informe de cartera',
        'docSubtitle' => 'Apartados y créditos pendientes',
        'periodLabel' => $periodLabel,
        'generatedAt' => $generatedAt,
    ])

    @include('reports.partials.pdf-kpis', ['kpis' => $kpis])
    @include('reports.partials.pdf-methodology', ['text' => $report['methodology'] ?? null])

    <div class="section">
        <p class="section-title">Detalle de cartera</p>
        @if ($items->isEmpty())
            <p class="empty">No hay saldos pendientes por cobrar con los filtros aplicados.</p>
        @else
            <table class="data-table data-table--ledger">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Remisión</th>
                        <th>Equipo</th>
                        <th>Cliente</th>
                        <th class="num">Total</th>
                        <th class="num">Pagado</th>
                        <th class="num">Pendiente</th>
                        <th>Vence</th>
                        <th>Vendedor</th>
                        <th>Financiera</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($items as $row)
                        @php
                            $dueAt = $row['due_at'] ?? null;
                            $dueLabel = $dueAt
                                ? \Carbon\Carbon::parse($dueAt)->timezone('America/Bogota')->format('d/m/Y')
                                : '—';
                            if (($row['is_overdue'] ?? false) && ($row['days_overdue'] ?? 0) > 0) {
                                $dueLabel .= ' ('.$row['days_overdue'].'d)';
                            }
                            $customer = $row['customer'] ?? '—';
                            if (! empty($row['customer_phone'])) {
                                $customer .= ' · '.$row['customer_phone'];
                            }
                        @endphp
                        <tr>
                            <td>{{ $row['type_label'] ?? $row['type'] ?? '—' }}</td>
                            <td>{{ $row['remission_number'] ?? '—' }}</td>
                            <td>{{ $row['item'] ?? '—' }}</td>
                            <td>{{ $customer }}</td>
                            <td class="num">{{ MoneyFormatter::format($row['sale_price'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($row['amount_paid'] ?? 0) }}</td>
                            <td class="num num--profit">{{ MoneyFormatter::format($row['amount_due'] ?? 0) }}</td>
                            <td>{{ $dueLabel }}</td>
                            <td>{{ $row['seller'] ?? '—' }}</td>
                            <td>{{ $row['credit_payment_method'] ?? '—' }}</td>
                            <td class="{{ ($row['is_overdue'] ?? false) ? 'status-overdue' : 'status-ok' }}">
                                {{ ($row['is_overdue'] ?? false) ? 'Vencido' : 'Al día' }}
                            </td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4">Totales ({{ $totals['count'] ?? $items->count() }})</td>
                        <td class="num">{{ MoneyFormatter::format(collect($items)->sum('sale_price')) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['total_paid'] ?? 0) }}</td>
                        <td class="num">{{ MoneyFormatter::format($totals['total_due'] ?? 0) }}</td>
                        <td colspan="4"></td>
                    </tr>
                </tfoot>
            </table>
        @endif
    </div>

    @include('reports.partials.pdf-footer')
</body>
</html>

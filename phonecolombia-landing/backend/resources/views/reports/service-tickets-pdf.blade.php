<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Servicio técnico — {{ $dateLabel }}</title>
    @include('reports.partials.pdf-styles')
</head>
<body>
    @php
        use App\Support\MoneyFormatter;

        $totals = $report['totals'] ?? [];
        $tickets = collect($report['tickets'] ?? []);
        $byStatus = collect($report['by_status'] ?? []);
        $byTechnician = collect($report['by_technician'] ?? []);
        $showDate = (bool) ($report['is_range'] ?? false);

        $kpis = [
            ['label' => 'Tickets', 'value' => (string) ($totals['count'] ?? 0), 'tone' => 'blue'],
            ['label' => 'Abiertos', 'value' => (string) ($totals['open_count'] ?? 0), 'tone' => 'amber'],
            ['label' => 'Cerrados', 'value' => (string) ($totals['closed_count'] ?? 0), 'tone' => 'green'],
            ['label' => 'Costo reparación', 'value' => MoneyFormatter::format($totals['repair_cost'] ?? 0), 'tone' => 'slate'],
            ['label' => 'Precio al cliente', 'value' => MoneyFormatter::format($totals['customer_price'] ?? 0), 'tone' => 'purple'],
            ['label' => 'Margen', 'value' => MoneyFormatter::format($totals['margin'] ?? 0), 'tone' => 'green'],
        ];
        if (($totals['margin_percent'] ?? null) !== null) {
            $kpis[] = ['label' => 'Margen %', 'value' => ($totals['margin_percent'] ?? 0).'%', 'tone' => 'amber'];
        }

        $formatDateTime = function ($value) use ($showDate) {
            if (! $value) {
                return '—';
            }
            $carbon = \Carbon\Carbon::parse($value)->timezone('America/Bogota');

            return $showDate ? $carbon->format('d/m/Y H:i') : $carbon->format('H:i');
        };
    @endphp

    @include('reports.partials.pdf-header', [
        'docLabel' => 'Servicio técnico',
        'docSubtitle' => 'Tickets recibidos en el período',
        'periodLabel' => $periodLabel,
        'generatedAt' => $generatedAt,
    ])

    @include('reports.partials.pdf-kpis', ['kpis' => $kpis])
    @include('reports.partials.pdf-methodology', ['text' => $report['methodology'] ?? null])

    @if ($byStatus->isNotEmpty())
        <div class="section">
            <p class="section-title">Por estado</p>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Estado</th>
                        <th class="num">Tickets</th>
                        <th class="num">Costo</th>
                        <th class="num">Precio cliente</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($byStatus as $row)
                        <tr>
                            <td>{{ $row['status_label'] ?? ($row['status'] ?? '—') }}</td>
                            <td class="num">{{ $row['count'] ?? 0 }}</td>
                            <td class="num">{{ MoneyFormatter::format($row['repair_cost'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($row['customer_price'] ?? 0) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif

    @if ($byTechnician->isNotEmpty())
        <div class="section">
            <p class="section-title">Por técnico</p>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Técnico</th>
                        <th class="num">Tickets</th>
                        <th class="num">Costo</th>
                        <th class="num">Precio cliente</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($byTechnician as $row)
                        <tr>
                            <td>{{ $row['technician'] ?? '—' }}</td>
                            <td class="num">{{ $row['count'] ?? 0 }}</td>
                            <td class="num">{{ MoneyFormatter::format($row['repair_cost'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($row['customer_price'] ?? 0) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif

    <div class="section">
        <p class="section-title">Detalle de tickets</p>
        @if ($tickets->isEmpty())
            <p class="empty">No hay tickets en este período con los filtros aplicados.</p>
        @else
            <table class="data-table data-table--ledger">
                <thead>
                    <tr>
                        <th>{{ $showDate ? 'Recibido' : 'Hora' }}</th>
                        <th>Equipo</th>
                        <th>Referencia</th>
                        <th>Tipo</th>
                        <th>Cliente</th>
                        <th>Estado</th>
                        <th>Técnico</th>
                        <th class="num">Costo</th>
                        <th class="num">Precio</th>
                        <th class="num">Margen</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($tickets as $ticket)
                        <tr>
                            <td>{{ $formatDateTime($ticket['received_at'] ?? null) }}</td>
                            <td>{{ $ticket['display_name'] ?? '—' }}</td>
                            <td class="mono">{{ $ticket['device_reference'] ?? ($ticket['imei'] ?? '—') }}</td>
                            <td>{{ $ticket['ticket_type_label'] ?? ($ticket['ticket_type'] ?? '—') }}</td>
                            <td>{{ $ticket['customer_name'] ?? '—' }}</td>
                            <td>{{ $ticket['status_label'] ?? ($ticket['status'] ?? '—') }}</td>
                            <td>{{ $ticket['technician'] ?? '—' }}</td>
                            <td class="num">{{ MoneyFormatter::format($ticket['repair_cost'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($ticket['customer_price'] ?? 0) }}</td>
                            <td class="num num--profit">{{ MoneyFormatter::format($ticket['margin'] ?? 0) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    </div>

    @include('reports.partials.pdf-footer')
</body>
</html>

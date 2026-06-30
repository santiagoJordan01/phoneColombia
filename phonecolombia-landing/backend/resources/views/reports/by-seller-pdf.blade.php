<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Informe por vendedor — {{ $dateLabel }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1e293b; margin: 28px; }
        h1 { font-size: 18px; margin: 0 0 4px; color: #0f172a; }
        h2 { font-size: 13px; margin: 18px 0 6px; color: #1e3a5f; }
        .meta { color: #64748b; margin-bottom: 18px; font-size: 10px; }
        .summary { margin-bottom: 16px; padding: 10px 12px; background: #f1f5f9; border-radius: 6px; }
        .seller-meta { color: #475569; font-size: 10px; margin: 0 0 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        th { background: #e2e8f0; text-align: left; padding: 6px 7px; font-size: 9px; text-transform: uppercase; }
        td { border-bottom: 1px solid #e2e8f0; padding: 6px 7px; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .ranking { margin-bottom: 14px; }
        .empty { color: #64748b; font-style: italic; padding: 12px 0; }
        .footer { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; }
        .page-break { page-break-before: always; }
    </style>
</head>
<body>
    <h1>Phone Colombia — Informe por vendedor</h1>
    <p class="meta">Período: <strong>{{ $periodLabel }}</strong> · Generado: {{ $generatedAt }}</p>

    @php
        $totals = $report['totals'] ?? [];
        $sellers = collect($report['sellers'] ?? []);
    @endphp

    <div class="summary">
        Total ventas: <strong>{{ $totals['count'] ?? 0 }}</strong> ·
        Recaudado: <strong>${{ number_format((float) ($totals['collected'] ?? 0), 0, ',', '.') }}</strong> ·
        Utilidad: <strong>${{ number_format((float) ($totals['profit'] ?? 0), 0, ',', '.') }}</strong>
    </div>

    @if ($sellers->isEmpty())
        <p class="empty">No hay ventas por vendedor en este período con los filtros aplicados.</p>
    @else
        <div class="ranking">
            <h2>Resumen por vendedor</h2>
            <table>
                <thead>
                    <tr>
                        <th>Vendedor</th>
                        <th>Ventas</th>
                        <th>Recaudado</th>
                        <th>Ingresos</th>
                        <th>Utilidad</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($sellers as $group)
                        <tr>
                            <td>{{ $group['seller'] ?? 'Sin vendedor' }}</td>
                            <td>{{ $group['count'] ?? 0 }}</td>
                            <td>${{ number_format((float) ($group['collected'] ?? 0), 0, ',', '.') }}</td>
                            <td>${{ number_format((float) ($group['revenue'] ?? 0), 0, ',', '.') }}</td>
                            <td>${{ number_format((float) ($group['profit'] ?? 0), 0, ',', '.') }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        @foreach ($sellers as $index => $group)
            @if ($index > 0)
                <div class="page-break"></div>
            @endif
            <h2>{{ $group['seller'] ?? 'Sin vendedor' }}</h2>
            <p class="seller-meta">
                {{ $group['count'] ?? 0 }} ventas ·
                Recaudado ${{ number_format((float) ($group['collected'] ?? 0), 0, ',', '.') }} ·
                Utilidad ${{ number_format((float) ($group['profit'] ?? 0), 0, ',', '.') }}
            </p>
            @php $sales = collect($group['sales'] ?? []); @endphp
            @if ($sales->isEmpty())
                <p class="empty">Sin ventas.</p>
            @else
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Equipo</th>
                            <th>IMEI</th>
                            <th>Precio</th>
                            <th>Utilidad</th>
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
                                <td>{{ $sale['imei'] ?? '—' }}</td>
                                <td>${{ number_format((float) ($sale['sale_price_num'] ?? 0), 0, ',', '.') }}</td>
                                <td>${{ number_format((float) ($sale['net_profit'] ?? 0), 0, ',', '.') }}</td>
                                <td>{{ $sale['payment_method'] ?? '—' }}</td>
                                <td>{{ $sale['customer'] ?? '—' }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            @endif
        @endforeach
    @endif

    <p class="footer">Documento generado automáticamente por Phone Colombia Inventario</p>
</body>
</html>

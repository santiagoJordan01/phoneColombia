<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Informe de ventas — {{ $dateLabel }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #1e293b; margin: 28px; }
        h1 { font-size: 18px; margin: 0 0 4px; color: #0f172a; }
        .meta { color: #64748b; margin-bottom: 12px; font-size: 10px; }
        .summary { margin-bottom: 12px; padding: 10px 12px; background: #f1f5f9; border-radius: 6px; line-height: 1.5; }
        .note { color: #64748b; font-size: 9px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #e2e8f0; text-align: left; padding: 6px 5px; font-size: 8px; text-transform: uppercase; }
        td { border-bottom: 1px solid #e2e8f0; padding: 6px 5px; vertical-align: top; font-size: 9px; }
        tr:nth-child(even) td { background: #f8fafc; }
        .methods { margin-top: 14px; }
        .methods h2 { font-size: 12px; margin: 0 0 6px; }
        .empty { color: #64748b; font-style: italic; padding: 12px 0; }
        .footer { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; }
    </style>
</head>
<body>
    <h1>Phone Colombia — Informe de ventas</h1>
    <p class="meta">Período: <strong>{{ $periodLabel }}</strong> · Generado: {{ $generatedAt }}</p>

    <div class="summary">
        Ventas: <strong>{{ $report['totals']['count'] ?? 0 }}</strong> ·
        Ingresos: <strong>${{ number_format((float) ($report['totals']['revenue'] ?? 0), 0, ',', '.') }}</strong> ·
        Costo: <strong>${{ number_format((float) ($report['totals']['cost'] ?? 0), 0, ',', '.') }}</strong> ·
        Utilidad bruta: <strong>${{ number_format((float) ($report['totals']['profit'] ?? 0), 0, ',', '.') }}</strong> ·
        Recaudado: <strong>${{ number_format((float) ($report['totals']['collected'] ?? 0), 0, ',', '.') }}</strong> ·
        Pendiente: <strong>${{ number_format((float) ($report['totals']['pending'] ?? 0), 0, ',', '.') }}</strong>
    </div>

    @if (!empty($report['methodology']))
        <p class="note">{{ $report['methodology'] }}</p>
    @endif

    @php $sales = collect($report['sales'] ?? []); @endphp

    @if ($sales->isEmpty())
        <p class="empty">No hay ventas registradas para este período con los filtros aplicados.</p>
    @else
        <table>
            <thead>
                <tr>
                    <th>{{ ($report['is_range'] ?? false) ? 'Fecha' : 'Hora' }}</th>
                    <th>Equipo</th>
                    <th>IMEI</th>
                    <th>Venta</th>
                    <th>Costo</th>
                    <th>Utilidad</th>
                    <th>Pagado</th>
                    <th>Pendiente</th>
                    <th>Método</th>
                    <th>Vendedor</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($sales as $sale)
                    @php
                        $soldAt = $sale['sold_at'] ?? null;
                        $time = $soldAt
                            ? (($report['is_range'] ?? false)
                                ? \Carbon\Carbon::parse($soldAt)->timezone('America/Bogota')->format('d/m/Y H:i')
                                : \Carbon\Carbon::parse($soldAt)->timezone('America/Bogota')->format('H:i'))
                            : '—';
                    @endphp
                    <tr>
                        <td>{{ $time }}</td>
                        <td>{{ $sale['item'] ?? '—' }}</td>
                        <td>{{ $sale['imei'] ?? '—' }}</td>
                        <td>${{ number_format((float) ($sale['sale_price_num'] ?? 0), 0, ',', '.') }}</td>
                        <td>${{ number_format((float) ($sale['purchase_price_num'] ?? 0), 0, ',', '.') }}</td>
                        <td>${{ number_format((float) ($sale['net_profit'] ?? 0), 0, ',', '.') }}</td>
                        <td>${{ number_format((float) ($sale['amount_paid'] ?? 0), 0, ',', '.') }}</td>
                        <td>${{ number_format((float) ($sale['amount_due'] ?? 0), 0, ',', '.') }}</td>
                        <td>{{ $sale['payment_method'] ?? '—' }}</td>
                        <td>{{ $sale['seller'] ?? '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    @php $byMethod = $report['totals']['by_method'] ?? []; @endphp
    @if (is_array($byMethod) && count($byMethod) > 0)
        <div class="methods">
            <h2>Cobros registrados por método de pago</h2>
            <table>
                <thead>
                    <tr><th>Método</th><th>Monto</th></tr>
                </thead>
                <tbody>
                    @foreach ($byMethod as $method => $amount)
                        <tr>
                            <td>{{ $method }}</td>
                            <td>${{ number_format((float) $amount, 0, ',', '.') }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif

    <p class="footer">Documento gerencial. No incluye impuestos ni gastos operativos.</p>
</body>
</html>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Ingresos al inventario — {{ $dateLabel }}</title>
    @include('reports.partials.pdf-styles')
</head>
<body>
    @php
        use App\Support\MoneyFormatter;

        $totals = $report['totals'] ?? [];
        $groups = collect($report['by_supplier'] ?? []);
        $items = collect($report['items'] ?? []);
        $showDate = (bool) ($report['is_range'] ?? false);

        $kpis = [
            ['label' => 'Equipos ingresados', 'value' => (string) ($totals['count'] ?? 0), 'tone' => 'blue'],
            ['label' => 'Costo total compra', 'value' => MoneyFormatter::format($totals['purchase_total'] ?? 0), 'tone' => 'slate'],
            ['label' => 'Valor venta referencia', 'value' => MoneyFormatter::format($totals['sale_value_total'] ?? 0), 'tone' => 'purple'],
            ['label' => 'Proveedores', 'value' => (string) ($totals['supplier_count'] ?? 0), 'tone' => 'green'],
        ];

        $formatDateTime = function ($value) use ($showDate) {
            if (! $value) {
                return '—';
            }
            $carbon = \Carbon\Carbon::parse($value)->timezone('America/Bogota');

            return $showDate ? $carbon->format('d/m/Y H:i') : $carbon->format('H:i');
        };
    @endphp

    @include('reports.partials.pdf-header', [
        'docLabel' => 'Ingresos al inventario',
        'docSubtitle' => 'Equipos dados de alta por fecha de ingreso',
        'periodLabel' => $periodLabel,
        'generatedAt' => $generatedAt,
    ])

    @include('reports.partials.pdf-kpis', ['kpis' => $kpis])
    @include('reports.partials.pdf-methodology', ['text' => $report['methodology'] ?? null])

    @if ($groups->isNotEmpty())
        <div class="section">
            <p class="section-title">Resumen por proveedor</p>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Proveedor</th>
                        <th class="num">Cantidad</th>
                        <th class="num">Costo compra</th>
                        <th class="num">Valor venta</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($groups as $group)
                        <tr>
                            <td>{{ $group['supplier_name'] ?? '—' }}</td>
                            <td class="num">{{ $group['count'] ?? 0 }}</td>
                            <td class="num">{{ MoneyFormatter::format($group['purchase_total'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($group['sale_value_total'] ?? 0) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif

    <div class="section">
        <p class="section-title">Detalle de ingresos</p>
        @if ($items->isEmpty())
            <p class="empty">No hay equipos ingresados en este período con los filtros aplicados.</p>
        @else
            <table class="data-table data-table--ledger">
                <thead>
                    <tr>
                        <th>{{ $showDate ? 'Fecha ingreso' : 'Hora' }}</th>
                        <th>Equipo</th>
                        <th>IMEI / Código</th>
                        <th>Color</th>
                        <th>Proveedor</th>
                        <th class="num">Costo</th>
                        <th class="num">Precio venta</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($items as $item)
                        <tr>
                            <td>{{ $formatDateTime($item['acquired_at'] ?? null) }}</td>
                            <td>{{ $item['name'] ?? '—' }}</td>
                            <td class="mono">{{ $item['imei'] ?? ($item['barcode'] ?? '—') }}</td>
                            <td>{{ $item['color'] ?? '—' }}</td>
                            <td>{{ $item['supplier'] ?? '—' }}</td>
                            <td class="num">{{ MoneyFormatter::format($item['purchase_price'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($item['sale_price'] ?? 0) }}</td>
                            <td>{{ $item['status_label'] ?? ($item['status'] ?? '—') }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    </div>

    @include('reports.partials.pdf-footer')
</body>
</html>

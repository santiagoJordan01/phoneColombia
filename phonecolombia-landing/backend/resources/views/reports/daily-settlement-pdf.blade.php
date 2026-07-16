<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Cuadre de caja — {{ $dateLabel }}</title>
    @include('reports.partials.pdf-styles')
    <style>
        .settlement-meta { margin: 0 0 12px; font-size: 11px; color: #334155; }
        .settlement-meta strong { color: #0f172a; }
        .formas-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .formas-table th, .formas-table td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 10px; }
        .formas-table th { background: #1e3a5f; color: #fff; text-align: left; }
        .formas-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .diff-row td { font-weight: bold; background: #f8fafc; }
        .equipos-table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
        .equipos-table th, .equipos-table td { border: 1px solid #e2e8f0; padding: 4px 5px; vertical-align: top; }
        .equipos-table th { background: #1e3a5f; color: #fff; font-size: 8px; text-transform: uppercase; }
        .equipos-table td.num { text-align: right; white-space: nowrap; }
        .neg { color: #b45309; }
        .origen { font-size: 8px; text-transform: uppercase; letter-spacing: 0.03em; color: #475569; }
    </style>
</head>
<body>
    @php
        use App\Support\MoneyFormatter;
        $formas = $report['formas_de_pago'] ?? [];
        $equipos = $report['equipos_vendidos'] ?? [];
        $movimientos = $report['movimientos_caja'] ?? [];
    @endphp

    @include('reports.partials.pdf-header', [
        'docLabel' => 'Cuadre de caja',
        'docSubtitle' => 'Cuadre del día',
        'periodLabel' => $periodLabel,
        'generatedAt' => $generatedAt,
    ])

    <p class="settlement-meta">
        <strong>Fecha:</strong> {{ $report['fecha'] ?? $periodLabel }}
        &nbsp;·&nbsp;
        <strong>Ventas netas:</strong> {{ MoneyFormatter::format($report['ventas_netas'] ?? 0) }}
        &nbsp;·&nbsp;
        <strong>Costo:</strong> {{ MoneyFormatter::format($report['total_costo'] ?? 0) }}
        &nbsp;·&nbsp;
        <strong>Utilidad bruta:</strong> {{ MoneyFormatter::format($report['utilidad_bruta'] ?? 0) }}
        &nbsp;·&nbsp;
        <strong>Ingresos caja:</strong> {{ MoneyFormatter::format($report['total_ingresos'] ?? 0) }}
        (cobros {{ MoneyFormatter::format($report['ingresos_cobros'] ?? $report['ingresos_venta'] ?? 0) }}
        + manual {{ MoneyFormatter::format($report['ingresos_manuales'] ?? 0) }})
        &nbsp;·&nbsp;
        <strong>Egresos caja:</strong> {{ MoneyFormatter::format($report['total_egresos'] ?? 0) }}
        (retoma {{ MoneyFormatter::format($report['egresos_retoma'] ?? 0) }}
        + manual {{ MoneyFormatter::format($report['egresos_manuales'] ?? 0) }})
        &nbsp;·&nbsp;
        <strong>Neto caja:</strong> {{ MoneyFormatter::format($report['neto_caja'] ?? 0) }}
        &nbsp;·&nbsp;
        <strong>Dif. ventas:</strong> {{ MoneyFormatter::format($report['diferencia'] ?? 0) }}
        (precio − cobrado acum. {{ MoneyFormatter::format($report['cobrado_acumulado_ventas'] ?? 0) }}
        − pendiente {{ MoneyFormatter::format($report['pendiente_ventas'] ?? $report['credito_del_dia'] ?? 0) }})
    </p>

    @include('reports.partials.pdf-methodology', ['text' => $report['methodology'] ?? null])

    <div class="section">
        <p class="section-title">Formas de pago</p>
        <table class="formas-table">
            <thead>
                <tr>
                    <th>Método</th>
                    <th style="text-align:right">Monto</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($formas as $forma)
                    <tr>
                        <td>{{ $forma['label'] ?? '—' }}</td>
                        <td class="num">{{ MoneyFormatter::format($forma['amount'] ?? 0) }}</td>
                    </tr>
                @endforeach
                <tr class="diff-row">
                    <td>Formas de caja (sin crédito)</td>
                    <td class="num">{{ MoneyFormatter::format($report['total_formas_caja'] ?? 0) }}</td>
                </tr>
                <tr class="diff-row">
                    <td>Neto de caja (ingresos − egresos)</td>
                    <td class="num">{{ MoneyFormatter::format($report['neto_caja'] ?? 0) }}</td>
                </tr>
                <tr class="diff-row">
                    <td>Diferencia ventas (precio − cobrado − pendiente)</td>
                    <td class="num {{ ((float) ($report['diferencia'] ?? 0)) != 0.0 ? 'neg' : '' }}">
                        {{ MoneyFormatter::format($report['diferencia'] ?? 0) }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="section">
        <p class="section-title">Equipos vendidos</p>
        @if (count($equipos) === 0)
            <p style="font-size:10px;color:#64748b;">No hay equipos vendidos en este período.</p>
        @else
            <table class="equipos-table">
                <thead>
                    <tr>
                        <th>Origen</th>
                        <th>Equipo</th>
                        <th>IMEI</th>
                        <th>Proveedor</th>
                        <th>Costo</th>
                        <th>Valor</th>
                        <th>Utilidad</th>
                        <th>Cobrado hoy</th>
                        <th>Pendiente</th>
                        <th>Responsable</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($equipos as $equipo)
                        <tr>
                            <td class="origen">{{ $equipo['origen_label'] ?? 'Venta' }}</td>
                            <td>{{ $equipo['equipo'] ?? '—' }}</td>
                            <td>{{ $equipo['imei'] ?? '—' }}</td>
                            <td>{{ $equipo['proveedor'] ?? '—' }}</td>
                            <td class="num">{{ MoneyFormatter::format($equipo['costo'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($equipo['valor'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($equipo['utilidad'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($equipo['ingreso'] ?? 0) }}</td>
                            <td class="num">{{ MoneyFormatter::format($equipo['pendiente'] ?? 0) }}</td>
                            <td>{{ $equipo['responsable'] ?? '—' }}</td>
                        </tr>
                    @endforeach
                    <tr class="diff-row">
                        <td colspan="4"><strong>Totales equipos</strong></td>
                        <td class="num"><strong>{{ MoneyFormatter::format($report['total_costo'] ?? 0) }}</strong></td>
                        <td class="num"><strong>{{ MoneyFormatter::format($report['ventas_netas'] ?? 0) }}</strong></td>
                        <td class="num"><strong>{{ MoneyFormatter::format($report['utilidad_bruta'] ?? 0) }}</strong></td>
                        <td class="num"><strong>{{ MoneyFormatter::format($report['cobrado_ventas_del_dia'] ?? 0) }}</strong></td>
                        <td class="num"><strong>{{ MoneyFormatter::format($report['pendiente_ventas'] ?? $report['credito_del_dia'] ?? 0) }}</strong></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        @endif
    </div>

    <div class="section">
        <p class="section-title">Movimientos de caja</p>
        @if (count($movimientos) === 0)
            <p style="font-size:10px;color:#64748b;">Sin movimientos de caja en este período.</p>
        @else
            <table class="equipos-table">
                <thead>
                    <tr>
                        <th>Origen</th>
                        <th>Tipo</th>
                        <th>Concepto</th>
                        <th>Método</th>
                        <th>Costo</th>
                        <th>Monto</th>
                        <th>Responsable</th>
                        <th>Notas</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($movimientos as $mov)
                        <tr>
                            <td class="origen">{{ $mov['origen_label'] ?? '—' }}</td>
                            <td>{{ $mov['type_label'] ?? '—' }}</td>
                            <td>{{ $mov['concept'] ?? '—' }}</td>
                            <td>{{ $mov['method_label'] ?? '—' }}</td>
                            <td class="num">
                                {{ isset($mov['costo']) && $mov['costo'] !== null ? MoneyFormatter::format($mov['costo']) : '—' }}
                            </td>
                            <td class="num {{ ($mov['type'] ?? '') === 'egreso' ? 'neg' : '' }}">
                                {{ MoneyFormatter::format($mov['amount'] ?? 0) }}
                            </td>
                            <td>{{ $mov['responsable'] ?? '—' }}</td>
                            <td>{{ $mov['notes'] ?? '—' }}</td>
                        </tr>
                    @endforeach
                    <tr class="diff-row">
                        <td colspan="4"><strong>Totales</strong></td>
                        <td class="num"><strong>{{ MoneyFormatter::format($report['movimientos_costo_total'] ?? 0) }}</strong></td>
                        <td class="num">
                            <strong>Ing. {{ MoneyFormatter::format($report['total_ingresos'] ?? 0) }}</strong>
                            &nbsp;/&nbsp;
                            <strong class="neg">Egr. {{ MoneyFormatter::format($report['total_egresos'] ?? 0) }}</strong>
                        </td>
                        <td colspan="2"></td>
                    </tr>
                </tbody>
            </table>
        @endif
    </div>

    <div class="signatures" style="margin-top:28px; display:table; width:100%;">
        <div style="display:table-cell; width:50%; padding-right:24px;">
            <div style="border-bottom:1px solid #94a3b8; height:36px;"></div>
            <p style="margin:6px 0 0; font-size:10px;">Responsable: ____________________</p>
        </div>
        <div style="display:table-cell; width:50%; padding-left:24px;">
            <div style="border-bottom:1px solid #94a3b8; height:36px;"></div>
            <p style="margin:6px 0 0; font-size:10px;">Revisado por: ____________________</p>
        </div>
    </div>
</body>
</html>

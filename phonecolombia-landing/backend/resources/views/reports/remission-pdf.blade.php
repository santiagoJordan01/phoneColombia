<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Remisión {{ $sale['remission_number'] }}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 9.5px;
            color: #374151;
            margin: 0;
            padding: 0;
            line-height: 1.5;
        }

        .page {
            margin: 14px 16px;
            border: 1px solid #d1d5db;
            background: #ffffff;
        }
        .page__accent {
            height: 2px;
            background: #374151;
        }
        .page__body { padding: 18px 22px 16px; }

        .header {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .header td { vertical-align: middle; padding: 0 0 12px; }
        .header-brand {
            background: transparent;
            color: #111827;
            padding: 0 12px 0 0;
            width: 56%;
        }
        .header-brand-layout {
            width: 100%;
            border-collapse: collapse;
        }
        .header-brand-layout td {
            vertical-align: middle;
            padding: 0;
        }
        .header-brand__logo-wrap {
            width: 48px;
            padding-right: 10px;
        }
        .header-brand__logo {
            display: block;
            width: 42px;
            height: 42px;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
            object-fit: cover;
        }
        .header-brand__name {
            font-size: 15px;
            font-weight: bold;
            margin: 0 0 2px;
            color: #111827;
        }
        .header-brand__tagline {
            font-size: 8.5px;
            margin: 0;
            color: #6b7280;
        }
        .header-doc {
            background: transparent;
            padding: 0 0 0 12px;
            text-align: right;
            width: 44%;
        }
        .header-doc__label {
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            margin: 0 0 4px;
            font-weight: normal;
        }
        .header-doc__number {
            font-size: 14px;
            font-weight: bold;
            color: #111827;
            margin: 0 0 6px;
            letter-spacing: 0.02em;
            font-family: DejaVu Sans Mono, monospace;
        }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 7px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background: #f9fafb;
            color: #4b5563;
            border: 1px solid #d1d5db;
        }
        .badge--apartado { color: #4b5563; border-color: #d1d5db; }
        .badge--entregado { color: #374151; border-color: #9ca3af; }
        .badge--registrado { color: #6b7280; border-color: #e5e7eb; }

        .meta-row {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }
        .meta-row td {
            width: 33.33%;
            padding: 0 6px 0 0;
            vertical-align: top;
        }
        .meta-row td:last-child { padding-right: 0; }
        .meta-cell {
            border: 1px solid #e5e7eb;
            background: #fafafa;
            padding: 7px 10px;
        }
        .meta-cell__label {
            display: block;
            font-size: 6.5px;
            font-weight: normal;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #9ca3af;
            margin-bottom: 2px;
        }
        .meta-cell__value {
            font-size: 9.5px;
            font-weight: bold;
            color: #111827;
        }

        .section { margin-bottom: 14px; page-break-inside: avoid; }
        .section-head {
            margin-bottom: 7px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e5e7eb;
        }
        .section-head__title {
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #374151;
            margin: 0;
        }

        .grid-2 { width: 100%; border-collapse: collapse; }
        .grid-2 td { width: 50%; vertical-align: top; padding: 0 5px 0 0; }
        .grid-2 td + td { padding: 0 0 0 5px; }
        .info-box { border: 1px solid #e5e7eb; background: #ffffff; }
        .info-box__head {
            background: #f9fafb;
            color: #374151;
            padding: 5px 10px;
            font-size: 7px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            border-bottom: 1px solid #e5e7eb;
        }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td {
            padding: 6px 10px;
            vertical-align: top;
            font-size: 9px;
            border-bottom: 1px solid #f3f4f6;
        }
        .info-table tr:last-child td { border-bottom: none; }
        .info-table td.label { width: 34%; color: #6b7280; font-size: 8px; }
        .info-table td.value { color: #111827; font-weight: bold; }

        .product-box {
            border: 1px solid #e5e7eb;
            background: #ffffff;
        }
        .product-box__head {
            background: #ffffff;
            border-bottom: 1px solid #e5e7eb;
            padding: 8px 12px;
        }
        .product-name {
            font-size: 12px;
            font-weight: bold;
            color: #111827;
            margin: 0;
            line-height: 1.3;
        }
        .product-specs {
            width: 100%;
            border-collapse: collapse;
        }
        .product-specs td {
            padding: 7px 12px;
            font-size: 8.5px;
            border-top: 1px solid #f3f4f6;
            vertical-align: top;
        }
        .product-specs td.label {
            width: 22%;
            color: #6b7280;
            font-size: 7.5px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-weight: bold;
        }
        .product-specs td.value {
            color: #111827;
            font-weight: bold;
            font-family: DejaVu Sans Mono, monospace;
            font-size: 8.5px;
        }

        .finance-wrap {
            border: 1px solid #e5e7eb;
            background: #ffffff;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
        }
        .summary-table td {
            padding: 7px 12px;
            font-size: 9px;
            border-bottom: 1px solid #f3f4f6;
            vertical-align: middle;
        }
        .summary-table td.label { color: #6b7280; }
        .summary-table td.amount {
            text-align: right;
            font-weight: bold;
            color: #111827;
            width: 38%;
            font-size: 9.5px;
        }
        .summary-table tr.row-due td {
            background: #fafafa;
            border-top: 1px solid #d1d5db;
            border-bottom: none;
        }
        .summary-table tr.row-due td.label { color: #374151; font-weight: bold; }
        .summary-table tr.row-due td.amount { font-size: 10px; }
        .payment-method {
            padding: 7px 12px;
            background: #fafafa;
            border-top: 1px solid #e5e7eb;
            font-size: 8.5px;
            color: #6b7280;
        }
        .payment-method strong { color: #111827; }

        .payments-wrap { border: 1px solid #e5e7eb; }
        .payments { width: 100%; border-collapse: collapse; }
        .payments th {
            background: #f9fafb;
            color: #374151;
            text-align: left;
            padding: 6px 10px;
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 1px solid #d1d5db;
        }
        .payments th.right, .payments td.right { text-align: right; }
        .payments td {
            border-bottom: 1px solid #e5e7eb;
            padding: 6px 10px;
            font-size: 8.5px;
            vertical-align: top;
            color: #374151;
        }
        .payments tbody tr:nth-child(even) td { background: #fafafa; }
        .payments tfoot td {
            background: #f9fafb;
            font-weight: bold;
            border-top: 1px solid #d1d5db;
            border-bottom: none;
            color: #111827;
            font-size: 9px;
        }

        .notes-box {
            border: 1px solid #e5e7eb;
            background: #fafafa;
            padding: 9px 12px;
            font-size: 8.5px;
            color: #374151;
            line-height: 1.55;
        }

        .signatures {
            width: 100%;
            border-collapse: collapse;
            margin-top: 22px;
            page-break-inside: avoid;
        }
        .signatures td {
            width: 50%;
            text-align: center;
            padding: 0 12px;
            vertical-align: bottom;
        }
        .sign-area {
            height: 42px;
            border: 1px solid #e5e7eb;
            background: #ffffff;
            margin-bottom: 4px;
        }
        .sign-line {
            border-top: 1px solid #9ca3af;
            padding-top: 4px;
            font-size: 8px;
            color: #374151;
            font-weight: bold;
        }
        .sign-hint {
            font-size: 7px;
            color: #9ca3af;
            margin-top: 2px;
            font-weight: normal;
        }

        .footer {
            margin-top: 16px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            page-break-inside: avoid;
        }
        .footer__note {
            margin: 0;
            font-size: 7.5px;
            color: #6b7280;
            line-height: 1.5;
            text-align: center;
        }
        .footer__ref {
            margin: 5px 0 0;
            font-size: 7px;
            color: #9ca3af;
            letter-spacing: 0.03em;
            text-align: center;
            font-family: DejaVu Sans Mono, monospace;
        }
    </style>
</head>
<body>
@php
    $fmt = fn ($n) => '$'.number_format((float) $n, 0, ',', '.');
    $payments = collect($sale['payments'] ?? []);
    $paymentsTotal = $payments->sum('amount');
    $statusClass = $sale['status_class'] ?? 'badge--registrado';
    $salePrice = (float) ($sale['sale_price'] ?? 0);
    $amountPaid = (float) ($sale['amount_paid'] ?? 0);
@endphp
<div class="page">
    <div class="page__accent"></div>
    <div class="page__body">
        <table class="header">
            <tr>
                <td class="header-brand">
                    <table class="header-brand-layout">
                        <tr>
                            @if (!empty($logoDataUri))
                                <td class="header-brand__logo-wrap">
                                    <img src="{{ $logoDataUri }}" alt="Phone Colombia" class="header-brand__logo">
                                </td>
                            @endif
                            <td>
                                <p class="header-brand__name">Phone Colombia</p>
                                <p class="header-brand__tagline">Equipos móviles · Venta y entrega</p>
                            </td>
                        </tr>
                    </table>
                </td>
                <td class="header-doc">
                    <p class="header-doc__label">Remisión de venta</p>
                    <p class="header-doc__number">{{ $sale['remission_number'] }}</p>
                    <span class="badge {{ $statusClass }}">{{ $sale['status_label'] }}</span>
                </td>
            </tr>
        </table>

        <table class="meta-row">
            <tr>
                <td>
                    <div class="meta-cell">
                        <span class="meta-cell__label">Fecha documento</span>
                        <span class="meta-cell__value">{{ $sale['document_date'] }}</span>
                    </div>
                </td>
                <td>
                    <div class="meta-cell">
                        <span class="meta-cell__label">Fecha impresión</span>
                        <span class="meta-cell__value">{{ $generatedAt }}</span>
                    </div>
                </td>
                <td>
                    <div class="meta-cell">
                        <span class="meta-cell__label">Vendedor</span>
                        <span class="meta-cell__value">{{ $sale['seller'] ?: '—' }}</span>
                    </div>
                </td>
            </tr>
        </table>

        <div class="section">
            <div class="section-head">
                <p class="section-head__title">Cliente</p>
            </div>
            <table class="grid-2">
                <tr>
                    <td>
                        <div class="info-box">
                            <div class="info-box__head">Información de contacto</div>
                            <table class="info-table">
                                <tr>
                                    <td class="label">Nombre</td>
                                    <td class="value">{{ $sale['customer'] ?: '—' }}</td>
                                </tr>
                                <tr>
                                    <td class="label">Teléfono</td>
                                    <td class="value">{{ $sale['customer_phone'] ?: '—' }}</td>
                                </tr>
                            </table>
                        </div>
                    </td>
                    <td>
                        <div class="info-box">
                            <div class="info-box__head">Estado del documento</div>
                            <table class="info-table">
                                <tr>
                                    <td class="label">Estado</td>
                                    <td class="value">{{ $sale['status_label'] }}</td>
                                </tr>
                                <tr>
                                    <td class="label">Nº remisión</td>
                                    <td class="value">{{ $sale['remission_number'] }}</td>
                                </tr>
                            </table>
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        <div class="section">
            <div class="section-head">
                <p class="section-head__title">Equipo</p>
            </div>
            <div class="product-box">
                <div class="product-box__head">
                    <p class="product-name">{{ $sale['item'] ?: '—' }}</p>
                </div>
                <table class="product-specs">
                    <tr>
                        <td class="label">IMEI / Código</td>
                        <td class="value">{{ $sale['imei'] ?: '—' }}</td>
                        <td class="label">Color</td>
                        <td class="value">{{ $sale['color'] ?: '—' }}</td>
                    </tr>
                </table>
            </div>
        </div>

        <div class="section">
            <div class="section-head">
                <p class="section-head__title">Resumen financiero</p>
            </div>
            <div class="finance-wrap">
                <table class="summary-table">
                    <tr class="row-price">
                        <td class="label">Precio acordado</td>
                        <td class="amount">{{ $fmt($salePrice) }}</td>
                    </tr>
                    <tr class="row-paid">
                        <td class="label">Total pagado a la fecha</td>
                        <td class="amount">{{ $fmt($amountPaid) }}</td>
                    </tr>
                    <tr class="row-due">
                        <td class="label">Saldo pendiente</td>
                        <td class="amount">{{ $fmt($sale['amount_due']) }}</td>
                    </tr>
                </table>
                <div class="payment-method">
                    Método principal: <strong>{{ $sale['payment_method_label'] }}</strong>
                    @if (!empty($sale['credit_payment_method']))
                        · Financiera / crédito: <strong>{{ $sale['credit_payment_method'] }}</strong>
                    @endif
                </div>
            </div>
        </div>

        @if ($payments->isNotEmpty())
            <div class="section">
                <div class="section-head">
                    <p class="section-head__title">Detalle de pagos</p>
                </div>
                <div class="payments-wrap">
                    <table class="payments">
                        <thead>
                            <tr>
                                <th style="width: 28%">Fecha</th>
                                <th style="width: 22%">Método</th>
                                <th class="right" style="width: 18%">Monto</th>
                                <th>Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($payments as $payment)
                                <tr>
                                    <td>{{ $payment['paid_at'] }}</td>
                                    <td>{{ $payment['method'] }}</td>
                                    <td class="right">{{ $fmt($payment['amount']) }}</td>
                                    <td>{{ $payment['notes'] ?: '—' }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2">Total abonado</td>
                                <td class="right">{{ $fmt($paymentsTotal) }}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        @endif

        @if (!empty($sale['notes']))
            <div class="section">
                <div class="section-head">
                    <p class="section-head__title">Observaciones</p>
                </div>
                <div class="notes-box">{{ $sale['notes'] }}</div>
            </div>
        @endif

        <table class="signatures">
            <tr>
                <td>
                    <div class="sign-area"></div>
                    <div class="sign-line">Firma del cliente</div>
                    <div class="sign-hint">Nombre legible · Documento de identidad</div>
                </td>
                <td>
                    <div class="sign-area"></div>
                    <div class="sign-line">Phone Colombia · Vendedor</div>
                    <div class="sign-hint">Nombre legible · Cargo</div>
                </td>
            </tr>
        </table>

        <div class="footer">
            <p class="footer__note">Documento interno de respaldo comercial. No sustituye factura electrónica DIAN.</p>
            <p class="footer__ref">{{ $sale['remission_number'] }} · Generado {{ $generatedAt }}</p>
        </div>
    </div>
</div>
</body>
</html>

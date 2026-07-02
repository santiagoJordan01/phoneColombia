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
            color: #1e293b;
            margin: 0;
            padding: 0;
            line-height: 1.45;
        }

        .page {
            margin: 14px 16px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
        }
        .page__accent {
            height: 5px;
            background: #ea580c;
        }
        .page__body { padding: 18px 22px 16px; }

        /* Header */
        .header {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            border: 1px solid #e2e8f0;
        }
        .header td { vertical-align: middle; padding: 0; }
        .header-brand {
            background: #0f172a;
            color: #ffffff;
            padding: 14px 16px;
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
            width: 58px;
            padding-right: 12px;
        }
        .header-brand__logo {
            display: block;
            width: 52px;
            height: 52px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            object-fit: cover;
        }
        .header-brand__content {
            vertical-align: middle;
        }
        .header-brand__eyebrow {
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            color: #fb923c;
            margin: 0 0 5px;
            font-weight: bold;
        }
        .header-brand__name {
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 0.08em;
            margin: 0 0 4px;
        }
        .header-brand__tagline {
            font-size: 8.5px;
            margin: 0 0 8px;
            color: #cbd5e1;
        }
        .header-brand__rule {
            height: 2px;
            width: 48px;
            background: #ea580c;
            margin-bottom: 6px;
        }
        .header-brand__contact {
            font-size: 7.5px;
            margin: 0;
            color: #94a3b8;
        }
        .header-doc {
            background: #fafafa;
            padding: 14px 16px;
            text-align: center;
            width: 44%;
            border-left: 1px solid #e2e8f0;
        }
        .header-doc__label {
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            color: #64748b;
            margin: 0 0 5px;
            font-weight: bold;
        }
        .header-doc__number {
            font-size: 17px;
            font-weight: bold;
            color: #0f172a;
            margin: 0 0 8px;
            letter-spacing: 0.04em;
            font-family: DejaVu Sans Mono, monospace;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 7.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .badge--apartado { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }
        .badge--entregado { background: #d1fae5; color: #047857; border: 1px solid #6ee7b7; }
        .badge--registrado { background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; }

        /* Meta */
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
            border: 1px solid #e2e8f0;
            border-top: 2px solid #ea580c;
            background: #f8fafc;
            padding: 8px 10px;
        }
        .meta-cell__label {
            display: block;
            font-size: 6.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #94a3b8;
            margin-bottom: 3px;
        }
        .meta-cell__value {
            font-size: 9.5px;
            font-weight: bold;
            color: #0f172a;
        }

        /* Sections */
        .section { margin-bottom: 14px; page-break-inside: avoid; }
        .section-head {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }
        .section-head td { vertical-align: middle; padding: 0; }
        .section-head__num {
            width: 22px;
            height: 22px;
            background: #ea580c;
            color: #ffffff;
            font-size: 8px;
            font-weight: bold;
            text-align: center;
            line-height: 22px;
        }
        .section-head__title {
            padding-left: 8px;
            font-size: 8.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #0f172a;
        }
        .section-head__line {
            border-bottom: 1px solid #e2e8f0;
            width: 100%;
        }

        /* Info panels */
        .grid-2 { width: 100%; border-collapse: collapse; }
        .grid-2 td { width: 50%; vertical-align: top; padding: 0 5px 0 0; }
        .grid-2 td + td { padding: 0 0 0 5px; }
        .info-box { border: 1px solid #e2e8f0; background: #ffffff; }
        .info-box__head {
            background: #0f172a;
            color: #f8fafc;
            padding: 5px 10px;
            font-size: 7px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td {
            padding: 7px 10px;
            vertical-align: top;
            font-size: 9.5px;
            border-bottom: 1px solid #f1f5f9;
        }
        .info-table tr:last-child td { border-bottom: none; }
        .info-table td.label { width: 34%; color: #64748b; font-size: 8px; }
        .info-table td.value { color: #0f172a; font-weight: bold; }

        /* Product */
        .product-box {
            border: 1px solid #e2e8f0;
            background: #ffffff;
        }
        .product-box__head {
            background: #fff7ed;
            border-bottom: 1px solid #fed7aa;
            padding: 8px 12px;
        }
        .product-box__tag {
            font-size: 6.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #9a3412;
            margin: 0 0 3px;
        }
        .product-name {
            font-size: 14px;
            font-weight: bold;
            color: #0f172a;
            margin: 0;
            line-height: 1.25;
        }
        .product-specs {
            width: 100%;
            border-collapse: collapse;
        }
        .product-specs td {
            padding: 7px 12px;
            font-size: 8.5px;
            border-top: 1px solid #f1f5f9;
            vertical-align: top;
        }
        .product-specs td.label {
            width: 22%;
            color: #64748b;
            font-size: 7.5px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            font-weight: bold;
        }
        .product-specs td.value {
            color: #0f172a;
            font-weight: bold;
            font-family: DejaVu Sans Mono, monospace;
            font-size: 8.5px;
        }

        /* Finance */
        .finance-wrap {
            border: 1px solid #e2e8f0;
            background: #ffffff;
        }
        .finance-progress {
            padding: 10px 12px 8px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        .finance-progress__row {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5px;
        }
        .finance-progress__row td { padding: 0; vertical-align: middle; }
        .finance-progress__label {
            font-size: 7.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #64748b;
        }
        .finance-progress__pct {
            text-align: right;
            font-size: 9px;
            font-weight: bold;
            color: #047857;
        }
        .progress-track {
            width: 100%;
            height: 7px;
            background: #e2e8f0;
            border: 1px solid #cbd5e1;
        }
        .progress-fill {
            height: 100%;
            background: #059669;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
        }
        .summary-table td {
            padding: 8px 12px;
            font-size: 9px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
        }
        .summary-table td.label { color: #64748b; }
        .summary-table td.amount {
            text-align: right;
            font-weight: bold;
            color: #0f172a;
            width: 38%;
            font-size: 10px;
        }
        .summary-table tr.row-price td { background: #fff7ed; }
        .summary-table tr.row-price td.amount { font-size: 11px; }
        .summary-table tr.row-paid td.amount { color: #047857; }
        .summary-table tr.row-due td {
            background: #fef2f2;
            border-bottom: none;
        }
        .summary-table tr.row-due td.label { color: #991b1b; font-weight: bold; }
        .summary-table tr.row-due td.amount { color: #b91c1c; font-size: 12px; }
        .payment-method {
            padding: 8px 12px;
            background: #fafafa;
            border-top: 1px solid #e2e8f0;
            font-size: 8.5px;
            color: #475569;
        }
        .payment-method strong { color: #0f172a; }

        /* Payments */
        .payments-wrap { border: 1px solid #e2e8f0; }
        .payments { width: 100%; border-collapse: collapse; }
        .payments th {
            background: #0f172a;
            color: #f8fafc;
            text-align: left;
            padding: 7px 10px;
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: 0.07em;
        }
        .payments th.right, .payments td.right { text-align: right; }
        .payments td {
            border-bottom: 1px solid #e2e8f0;
            padding: 7px 10px;
            font-size: 8.5px;
            vertical-align: top;
            color: #334155;
        }
        .payments tbody tr:nth-child(even) td { background: #f8fafc; }
        .payments tfoot td {
            background: #fff7ed;
            font-weight: bold;
            border-top: 2px solid #ea580c;
            border-bottom: none;
            color: #0f172a;
            font-size: 9px;
        }

        /* Notes */
        .notes-box {
            border: 1px solid #e2e8f0;
            background: #fafafa;
            padding: 10px 12px;
            font-size: 8.5px;
            color: #334155;
            line-height: 1.55;
        }

        /* Signatures */
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
            height: 46px;
            border: 1px dashed #94a3b8;
            background: #fafafa;
            margin-bottom: 5px;
        }
        .sign-line {
            border-top: 1px solid #334155;
            padding-top: 5px;
            font-size: 8.5px;
            color: #0f172a;
            font-weight: bold;
        }
        .sign-hint {
            font-size: 7px;
            color: #94a3b8;
            margin-top: 2px;
            font-weight: normal;
        }

        /* Footer */
        .footer {
            margin-top: 18px;
            page-break-inside: avoid;
        }
        .footer__bar {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }
        .footer__bar td {
            height: 3px;
            padding: 0;
        }
        .footer__bar td.orange { background: #ea580c; width: 35%; }
        .footer__bar td.slate { background: #0f172a; }
        .footer__title {
            margin: 0 0 3px;
            font-size: 8px;
            font-weight: bold;
            color: #334155;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }
        .footer__note {
            margin: 0;
            font-size: 7.5px;
            color: #64748b;
            line-height: 1.5;
            text-align: center;
        }
        .footer__ref {
            margin: 6px 0 0;
            font-size: 7px;
            color: #94a3b8;
            letter-spacing: 0.05em;
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
    $paidPct = $salePrice > 0 ? min(100, (int) round(($amountPaid / $salePrice) * 100)) : 0;
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
                            <td class="header-brand__content">
                                <p class="header-brand__eyebrow">Comprobante oficial</p>
                                <p class="header-brand__name">PHONE COLOMBIA</p>
                                <p class="header-brand__tagline">Venta y entrega de equipos móviles</p>
                                <div class="header-brand__rule"></div>
                                <p class="header-brand__contact">Documento interno · Respaldo de operación comercial</p>
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
            <table class="section-head">
                <tr>
                    <td style="width: 22px;"><div class="section-head__num">01</div></td>
                    <td class="section-head__title">Datos del cliente</td>
                    <td class="section-head__line"></td>
                </tr>
            </table>
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
            <table class="section-head">
                <tr>
                    <td style="width: 22px;"><div class="section-head__num">02</div></td>
                    <td class="section-head__title">Equipo entregado / reservado</td>
                    <td class="section-head__line"></td>
                </tr>
            </table>
            <div class="product-box">
                <div class="product-box__head">
                    <p class="product-box__tag">Detalle del producto</p>
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
            <table class="section-head">
                <tr>
                    <td style="width: 22px;"><div class="section-head__num">03</div></td>
                    <td class="section-head__title">Resumen financiero</td>
                    <td class="section-head__line"></td>
                </tr>
            </table>
            <div class="finance-wrap">
                <div class="finance-progress">
                    <table class="finance-progress__row">
                        <tr>
                            <td class="finance-progress__label">Avance de pago</td>
                            <td class="finance-progress__pct">{{ $paidPct }}% abonado</td>
                        </tr>
                    </table>
                    <table class="progress-track" cellpadding="0" cellspacing="0">
                        <tr>
                            <td class="progress-fill" style="width: {{ $paidPct }}%;"></td>
                            @if ($paidPct < 100)
                                <td style="width: {{ 100 - $paidPct }}%;"></td>
                            @endif
                        </tr>
                    </table>
                </div>
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
                <table class="section-head">
                    <tr>
                        <td style="width: 22px;"><div class="section-head__num">04</div></td>
                        <td class="section-head__title">Detalle de pagos</td>
                        <td class="section-head__line"></td>
                    </tr>
                </table>
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
                <table class="section-head">
                    <tr>
                        <td style="width: 22px;"><div class="section-head__num">{{ $payments->isNotEmpty() ? '05' : '04' }}</div></td>
                        <td class="section-head__title">Observaciones</td>
                        <td class="section-head__line"></td>
                    </tr>
                </table>
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
            <table class="footer__bar">
                <tr>
                    <td class="orange"></td>
                    <td class="slate"></td>
                </tr>
            </table>
            <p class="footer__title">Comprobante interno de venta o apartado</p>
            <p class="footer__note">No sustituye factura electrónica DIAN. Conserve este documento como respaldo de la operación comercial.</p>
            <p class="footer__ref">{{ $sale['remission_number'] }} · Generado {{ $generatedAt }}</p>
        </div>
    </div>
</div>
</body>
</html>

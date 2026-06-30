<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Remisión {{ $sale['remission_number'] }}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 10px;
            color: #1e293b;
            margin: 0;
            padding: 0;
            line-height: 1.45;
        }
        .page { padding: 22px 28px 18px; }

        /* Header */
        .header {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
        }
        .header td { vertical-align: top; padding: 0; }
        .header-brand {
            background: #ea580c;
            color: #ffffff;
            padding: 14px 16px;
            width: 62%;
        }
        .header-brand__name {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 0.04em;
            margin: 0 0 2px;
        }
        .header-brand__tagline {
            font-size: 9px;
            opacity: 0.92;
            margin: 0;
        }
        .header-doc {
            background: #fff7ed;
            border: 2px solid #ea580c;
            padding: 10px 12px;
            text-align: center;
            width: 38%;
        }
        .header-doc__label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #9a3412;
            margin: 0 0 4px;
            font-weight: bold;
        }
        .header-doc__number {
            font-size: 15px;
            font-weight: bold;
            color: #0f172a;
            margin: 0 0 6px;
            letter-spacing: 0.02em;
        }
        .badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 10px;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }
        .badge--apartado { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }
        .badge--entregado { background: #d1fae5; color: #047857; border: 1px solid #6ee7b7; }
        .badge--registrado { background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; }

        .meta-row {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        .meta-row td {
            padding: 8px 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            font-size: 9px;
            color: #64748b;
        }
        .meta-row strong { color: #0f172a; }

        /* Sections */
        .section { margin-bottom: 14px; }
        .section-title {
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #ea580c;
            margin: 0 0 8px;
            padding-bottom: 4px;
            border-bottom: 2px solid #fed7aa;
        }

        .grid-2 {
            width: 100%;
            border-collapse: collapse;
        }
        .grid-2 td {
            width: 50%;
            vertical-align: top;
            padding: 0 8px 0 0;
        }
        .grid-2 td + td { padding: 0 0 0 8px; }

        .info-box {
            border: 1px solid #e2e8f0;
            background: #ffffff;
            padding: 10px 12px;
        }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td {
            padding: 4px 0;
            vertical-align: top;
            font-size: 10px;
        }
        .info-table td.label {
            width: 34%;
            color: #64748b;
            font-size: 9px;
        }
        .info-table td.value { color: #0f172a; font-weight: bold; }

        .product-box {
            border: 1px solid #e2e8f0;
            border-left: 4px solid #ea580c;
            background: #fffbeb;
            padding: 12px 14px;
        }
        .product-name {
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
            margin: 0 0 6px;
        }
        .product-meta {
            font-size: 9px;
            color: #475569;
            margin: 0;
        }

        /* Totals */
        .totals {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }
        .totals td {
            width: 33.33%;
            text-align: center;
            padding: 12px 8px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
        }
        .totals td.highlight {
            background: #fff7ed;
            border-color: #fdba74;
        }
        .totals td.pending {
            background: #fef3c7;
            border-color: #fcd34d;
        }
        .totals .label {
            display: block;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #64748b;
            margin-bottom: 4px;
        }
        .totals .amount {
            font-size: 14px;
            font-weight: bold;
            color: #0f172a;
        }
        .totals .amount--paid { color: #047857; }
        .totals .amount--due { color: #b45309; }

        .payment-method {
            margin-top: 8px;
            padding: 8px 10px;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            font-size: 9px;
            color: #475569;
        }
        .payment-method strong { color: #0f172a; }

        /* Payments table */
        .payments {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }
        .payments th {
            background: #ea580c;
            color: #ffffff;
            text-align: left;
            padding: 7px 8px;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }
        .payments th.right, .payments td.right { text-align: right; }
        .payments td {
            border-bottom: 1px solid #e2e8f0;
            padding: 7px 8px;
            font-size: 9px;
            vertical-align: top;
        }
        .payments tr:nth-child(even) td { background: #f8fafc; }
        .payments tfoot td {
            background: #fff7ed;
            font-weight: bold;
            border-top: 2px solid #fdba74;
            color: #0f172a;
        }

        .notes-box {
            border: 1px dashed #cbd5e1;
            background: #f8fafc;
            padding: 10px 12px;
            font-size: 9px;
            color: #334155;
        }

        .signatures {
            width: 100%;
            border-collapse: collapse;
            margin-top: 28px;
        }
        .signatures td {
            width: 50%;
            text-align: center;
            padding: 0 16px;
            vertical-align: bottom;
        }
        .sign-line {
            border-top: 1px solid #94a3b8;
            margin-top: 36px;
            padding-top: 6px;
            font-size: 9px;
            color: #64748b;
        }

        .footer {
            margin-top: 22px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            font-size: 8px;
            color: #94a3b8;
            text-align: center;
            line-height: 1.5;
        }
        .footer strong { color: #64748b; }
    </style>
</head>
<body>
@php
    $fmt = fn ($n) => '$'.number_format((float) $n, 0, ',', '.');
    $payments = collect($sale['payments'] ?? []);
    $paymentsTotal = $payments->sum('amount');
    $statusClass = $sale['status_class'] ?? 'badge--registrado';
@endphp
<div class="page">
    <table class="header">
        <tr>
            <td class="header-brand">
                <p class="header-brand__name">PHONE COLOMBIA</p>
                <p class="header-brand__tagline">Comprobante de venta y entrega · Equipos móviles</p>
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
            <td>Fecha documento: <strong>{{ $sale['document_date'] }}</strong></td>
            <td>Impreso: <strong>{{ $generatedAt }}</strong></td>
            <td>Vendedor: <strong>{{ $sale['seller'] ?: '—' }}</strong></td>
        </tr>
    </table>

    <div class="section">
        <div class="section-title">Datos del cliente</div>
        <table class="grid-2">
            <tr>
                <td>
                    <div class="info-box">
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
        <div class="section-title">Equipo entregado / reservado</div>
        <div class="product-box">
            <p class="product-name">{{ $sale['item'] ?: '—' }}</p>
            <p class="product-meta">
                @if (!empty($sale['imei']))
                    IMEI / Código: <strong>{{ $sale['imei'] }}</strong>
                @endif
                @if (!empty($sale['color']))
                    · Color: <strong>{{ $sale['color'] }}</strong>
                @endif
            </p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Resumen de valores</div>
        <table class="totals">
            <tr>
                <td class="highlight">
                    <span class="label">Precio acordado</span>
                    <span class="amount">{{ $fmt($sale['sale_price']) }}</span>
                </td>
                <td>
                    <span class="label">Total pagado</span>
                    <span class="amount amount--paid">{{ $fmt($sale['amount_paid']) }}</span>
                </td>
                <td class="pending">
                    <span class="label">Saldo pendiente</span>
                    <span class="amount amount--due">{{ $fmt($sale['amount_due']) }}</span>
                </td>
            </tr>
        </table>
        <div class="payment-method">
            Método principal: <strong>{{ $sale['payment_method_label'] }}</strong>
            @if (!empty($sale['credit_payment_method']))
                · Financiera / crédito: <strong>{{ $sale['credit_payment_method'] }}</strong>
            @endif
        </div>
    </div>

    @if ($payments->isNotEmpty())
        <div class="section">
            <div class="section-title">Detalle de pagos</div>
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
    @endif

    @if (!empty($sale['notes']))
        <div class="section">
            <div class="section-title">Observaciones</div>
            <div class="notes-box">{{ $sale['notes'] }}</div>
        </div>
    @endif

    <table class="signatures">
        <tr>
            <td>
                <div class="sign-line">Firma del cliente</div>
            </td>
            <td>
                <div class="sign-line">Firma / vendedor Phone Colombia</div>
            </td>
        </tr>
    </table>

    <div class="footer">
        <strong>Comprobante interno de venta o apartado.</strong> No sustituye factura electrónica DIAN.<br>
        Documento generado por el sistema Phone Colombia · {{ $sale['remission_number'] }}
    </div>
</div>
</body>
</html>

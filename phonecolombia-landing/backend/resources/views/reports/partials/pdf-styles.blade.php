<style>
    * { box-sizing: border-box; }
    body {
        font-family: DejaVu Sans, sans-serif;
        font-size: 9px;
        color: #1e293b;
        margin: 0;
        padding: 22px 26px 20px;
        line-height: 1.4;
    }

    /* Header */
    .header {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 14px;
        border: 1px solid #fed7aa;
    }
    .header td { vertical-align: middle; padding: 0; }
    .header-brand {
        background: #ea580c;
        color: #ffffff;
        padding: 14px 16px;
        width: 58%;
    }
    .header-brand__name {
        font-size: 17px;
        font-weight: bold;
        letter-spacing: 0.04em;
        margin: 0 0 3px;
    }
    .header-brand__tagline {
        font-size: 8px;
        margin: 0;
        opacity: 0.92;
    }
    .header-doc {
        background: #fff7ed;
        padding: 12px 14px;
        text-align: center;
        width: 42%;
    }
    .header-doc__label {
        font-size: 7px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #9a3412;
        margin: 0 0 3px;
        font-weight: bold;
    }
    .header-doc__sub {
        font-size: 8px;
        color: #78716c;
        margin: 0 0 4px;
    }
    .header-doc__period {
        font-size: 10px;
        font-weight: bold;
        color: #0f172a;
        margin: 0 0 3px;
        line-height: 1.35;
    }
    .header-doc__generated {
        font-size: 8px;
        color: #64748b;
        margin: 0;
    }

    /* KPI grid */
    .kpi-grid {
        width: 100%;
        border-collapse: separate;
        border-spacing: 5px 5px;
        margin: 0 -5px 12px;
    }
    .kpi-grid td {
        width: 16.66%;
        vertical-align: top;
        padding: 0;
    }
    .kpi {
        border: 1px solid #e2e8f0;
        border-top: 3px solid #64748b;
        border-radius: 5px;
        padding: 7px 8px;
        background: #ffffff;
    }
    .kpi--blue { border-top-color: #2563eb; }
    .kpi--purple { border-top-color: #7c3aed; }
    .kpi--slate { border-top-color: #64748b; }
    .kpi--green { border-top-color: #059669; }
    .kpi--amber { border-top-color: #d97706; }
    .kpi--orange { border-top-color: #ea580c; }
    .kpi__label {
        display: block;
        font-size: 6.5px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        margin-bottom: 3px;
    }
    .kpi__value {
        font-size: 10px;
        font-weight: bold;
        color: #0f172a;
    }

    /* Methodology */
    .methodology {
        margin: 0 0 12px;
        padding: 8px 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-left: 3px solid #ea580c;
    }
    .methodology__label {
        font-size: 6.5px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #9a3412;
        margin: 0 0 3px;
    }
    .methodology p {
        margin: 0;
        font-size: 8px;
        color: #475569;
        line-height: 1.45;
    }

    /* Sections */
    .section { margin-top: 14px; margin-bottom: 10px; }
    .section-title {
        font-size: 8px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #ea580c;
        margin: 0 0 7px;
        padding-bottom: 3px;
        border-bottom: 2px solid #fed7aa;
    }

    /* Seller block */
    .seller-block {
        margin-bottom: 12px;
        padding: 10px 11px;
        border: 1px solid #e2e8f0;
        background: #fafafa;
        page-break-inside: avoid;
    }
    .seller-block__name {
        font-size: 11px;
        font-weight: bold;
        color: #1e3a5f;
        margin: 0 0 3px;
    }
    .seller-block__meta {
        font-size: 8px;
        color: #64748b;
        margin: 0 0 8px;
    }

    /* Tables */
    .data-table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid #e2e8f0;
    }
    .data-table th {
        background: #1e3a5f;
        color: #f8fafc;
        text-align: left;
        padding: 5px 6px;
        font-size: 7px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .data-table th.num { text-align: right; }
    .data-table td {
        border-bottom: 1px solid #e2e8f0;
        padding: 5px 6px;
        vertical-align: top;
        font-size: 8px;
    }
    .data-table td.num {
        text-align: right;
        white-space: nowrap;
    }
    .data-table td.num--profit {
        color: #047857;
        font-weight: bold;
    }
    .data-table td.seller-name {
        font-weight: bold;
        color: #1e3a5f;
    }
    .data-table tbody tr:nth-child(even) td { background: #f8fafc; }
    .data-table tfoot td {
        border-top: 2px solid #cbd5e1;
        background: #f1f5f9;
        font-weight: bold;
        color: #0f172a;
    }
    .data-table--compact { max-width: 280px; }

    .empty {
        color: #64748b;
        font-style: italic;
        padding: 12px;
        text-align: center;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        margin: 8px 0;
    }

    /* Footer */
    .footer {
        margin-top: 22px;
        text-align: center;
    }
    .footer__line {
        height: 2px;
        background: #ea580c;
        margin-bottom: 10px;
        opacity: 0.55;
    }
    .footer p {
        margin: 2px 0;
        font-size: 8px;
        color: #64748b;
        font-weight: bold;
    }
    .footer__note {
        font-weight: normal !important;
        font-size: 7px !important;
        color: #94a3b8 !important;
    }

    .page-break { page-break-before: always; }
</style>

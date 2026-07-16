import {
  ReportPreviewEmpty,
  ReportPreviewFooter,
  ReportPreviewHeader,
  ReportPreviewKpis,
  ReportPreviewMethodology,
  ReportPreviewSection,
  collectionTypeLabel,
  formatDateLabel,
  paymentLabel,
  reportMoney,
} from "./ReportPreviewParts.jsx";

function formatLedgerWhen(paidAt, showDate) {
  if (!paidAt) return "—";
  const d = new Date(paidAt);
  if (showDate) {
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  }
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

export default function CashReportDocument({ report, from, to, generatedAt }) {
  const periodFrom = from || report?.period_from || report?.period?.from;
  const periodTo = to || report?.period_to || report?.period?.to;
  const isRange = report?.is_range ?? (periodFrom && periodTo && periodFrom !== periodTo);
  const periodLabel = periodFrom && periodTo && periodFrom !== periodTo
    ? `${formatDateLabel(periodFrom)} — ${formatDateLabel(periodTo)}`
    : formatDateLabel(periodTo || periodFrom);

  const byMethod = report?.by_payment_method && typeof report.by_payment_method === "object"
    ? Object.entries(report.by_payment_method)
    : [];
  const byType = report?.by_collection_type && typeof report.by_collection_type === "object"
    ? Object.entries(report.by_collection_type)
    : [];
  const ledger = report?.ledger || [];

  const kpis = [
    { label: "Ventas del período", value: report?.sales_count ?? 0, tone: "blue" },
    { label: "Ingresos (ventas)", value: reportMoney(report?.total_expected), tone: "purple" },
    {
      label: "Cobrado en período",
      value: reportMoney(report?.cash_collected_in_period ?? report?.total_collected),
      tone: "green",
    },
    { label: "Pendiente (ventas)", value: reportMoney(report?.pending_credits), tone: "amber" },
    { label: "Conciliación ventas", value: reportMoney(report?.difference), tone: "slate" },
    { label: "Costo total", value: reportMoney(report?.total_cost), tone: "slate" },
    { label: "Utilidad bruta", value: reportMoney(report?.total_profit), tone: "green" },
    {
      label: "Margen",
      value: report?.margin_percent != null ? `${report.margin_percent}%` : "—",
      tone: "amber",
    },
    { label: "Cobros ventas período", value: reportMoney(report?.collections_on_period_sales), tone: "green" },
    { label: "Apartados/abonos previos", value: reportMoney(report?.collections_on_other_sales), tone: "purple" },
  ];
  if ((report?.retake_outflows ?? 0) > 0) {
    kpis.push({
      label: "Pagos retoma",
      value: reportMoney(-Math.abs(report.retake_outflows)),
      tone: "orange",
    });
  }

  return (
    <div className="inv-report-doc">
      <ReportPreviewHeader
        docLabel="Libro de caja"
        docSubtitle={isRange ? "Período múltiple" : "Cobros y retomas del día"}
        periodLabel={periodLabel}
        generatedAt={generatedAt}
      />

      <ReportPreviewKpis items={kpis} />
      <ReportPreviewMethodology text={report?.methodology} />

      {byType.length > 0 && (
        <ReportPreviewSection title="Movimientos por tipo">
          <div className="inv-report-doc__kpis">
            {byType.map(([type, amount]) => (
              <article key={type} className="inv-report-doc__kpi" style={{ "--kpi-accent": "#64748b" }}>
                <span className="inv-report-doc__kpi-label">{collectionTypeLabel(type)}</span>
                <strong className="inv-report-doc__kpi-value">{reportMoney(amount)}</strong>
              </article>
            ))}
          </div>
        </ReportPreviewSection>
      )}

      {byMethod.length > 0 && (
        <ReportPreviewSection title="Neto del período por método">
          <div className="inv-report-doc__table-wrap inv-report-doc__table-wrap--compact">
            <table className="inv-report-doc__table inv-report-doc__table--compact">
              <thead>
                <tr>
                  <th>Método</th>
                  <th className="inv-report-doc__th-num">Neto</th>
                </tr>
              </thead>
              <tbody>
                {byMethod.map(([method, amount]) => (
                  <tr key={method}>
                    <td>{paymentLabel(method)}</td>
                    <td className={`inv-report-doc__num${Number(amount) < 0 ? " inv-report-doc__num--out" : " inv-report-doc__num--profit"}`}>
                      {reportMoney(amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportPreviewSection>
      )}

      <ReportPreviewSection title="Libro de cobros y retomas">
        {!ledger.length ? (
          <ReportPreviewEmpty>No hay movimientos de caja en este período.</ReportPreviewEmpty>
        ) : (
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table inv-report-doc__table--ledger">
              <thead>
                <tr>
                  <th>{isRange ? "Fecha" : "Hora"}</th>
                  <th>Remisión</th>
                  <th>Tipo</th>
                  <th>Equipo</th>
                  <th>Cliente</th>
                  <th>Método</th>
                  <th className="inv-report-doc__th-num">Monto</th>
                  <th>Vendedor</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((line) => (
                  <tr key={line.id}>
                    <td>{formatLedgerWhen(line.paid_at, isRange)}</td>
                    <td className="inv-cell-mono">{line.remission_number || "—"}</td>
                    <td>{line.type_label || collectionTypeLabel(line.type)}</td>
                    <td>{line.item || "—"}</td>
                    <td>{line.customer || "—"}</td>
                    <td>{paymentLabel(line.method)}</td>
                    <td className={`inv-report-doc__num${Number(line.amount) < 0 ? " inv-report-doc__num--out" : " inv-report-doc__num--profit"}`}>
                      {reportMoney(line.amount)}
                    </td>
                    <td>{line.seller || "—"}</td>
                    <td>{line.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportPreviewSection>

      <ReportPreviewFooter />
    </div>
  );
}

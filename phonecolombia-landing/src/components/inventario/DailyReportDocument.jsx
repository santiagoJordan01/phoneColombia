import {
  ReportPreviewEmpty,
  ReportPreviewFooter,
  ReportPreviewHeader,
  ReportPreviewKpis,
  ReportPreviewMethodology,
  ReportPreviewSection,
  formatDateLabel,
  formatMargin,
  paymentLabel,
  reportMoney,
} from "./ReportPreviewParts.jsx";

export default function DailyReportDocument({ report, date, from, to, generatedAt }) {
  const sales = report?.sales || [];
  const totals = report?.totals || {};
  const byMethod = totals.by_method || {};
  const methodEntries = Object.entries(byMethod);
  const periodFrom = from || report?.period_from;
  const periodTo = to || report?.period_to || date;
  const isRange = report?.is_range ?? (periodFrom && periodTo && periodFrom !== periodTo);
  const periodLabel = isRange
    ? `${formatDateLabel(periodFrom)} — ${formatDateLabel(periodTo)}`
    : formatDateLabel(periodTo);

  function saleWhen(soldAt) {
    if (!soldAt) return "—";
    if (isRange) {
      return new Date(soldAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
    }
    return new Date(soldAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }

  const kpis = [
    { label: "Ventas", value: totals.count ?? 0, tone: "blue" },
    { label: "Ingresos", value: reportMoney(totals.revenue), tone: "purple" },
    { label: "Costo total", value: reportMoney(totals.cost), tone: "slate" },
    { label: "Utilidad bruta", value: reportMoney(totals.profit), tone: "green" },
    { label: "Margen", value: formatMargin(totals.margin_percent), tone: "amber" },
    { label: "Pagado (ventas)", value: reportMoney(totals.collected), tone: "green" },
    ...(totals.pending > 0 ? [{ label: "Pendiente", value: reportMoney(totals.pending), tone: "orange" }] : []),
    ...((totals.collected_in_period ?? null) != null
      ? [{ label: "Cobros del período", value: reportMoney(totals.collected_in_period), tone: "blue" }]
      : []),
  ];

  return (
    <div className="inv-report-doc">
      <ReportPreviewHeader
        docLabel="Informe de ventas"
        docSubtitle={isRange ? "Período múltiple" : "Corte diario"}
        periodLabel={periodLabel}
        generatedAt={generatedAt}
      />

      <ReportPreviewKpis items={kpis} />
      <ReportPreviewMethodology text={report?.methodology} />

      {sales.length === 0 ? (
        <ReportPreviewEmpty>
          No hay ventas registradas para este período con los filtros aplicados.
        </ReportPreviewEmpty>
      ) : (
        <ReportPreviewSection title="Detalle de ventas">
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table">
              <thead>
                <tr>
                  <th>{isRange ? "Fecha" : "Hora"}</th>
                  <th>Remisión</th>
                  <th>Equipo</th>
                  <th>IMEI</th>
                  <th className="inv-report-doc__th-num">Venta</th>
                  <th className="inv-report-doc__th-num">Costo</th>
                  <th className="inv-report-doc__th-num">Utilidad</th>
                  <th className="inv-report-doc__th-num">Pagado</th>
                  <th className="inv-report-doc__th-num">Pendiente</th>
                  <th>Método</th>
                  <th>Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>{saleWhen(s.sold_at)}</td>
                    <td className="inv-cell-mono">{s.remission_number || "—"}</td>
                    <td>{s.item || "—"}</td>
                    <td className="inv-cell-mono">{s.imei || s.barcode || "—"}</td>
                    <td className="inv-report-doc__num">{reportMoney(s.sale_price_num ?? s.sale_price)}</td>
                    <td className="inv-report-doc__num">{reportMoney(s.purchase_price_num ?? 0)}</td>
                    <td className="inv-report-doc__num inv-report-doc__num--profit">{reportMoney(s.net_profit ?? 0)}</td>
                    <td className="inv-report-doc__num">{reportMoney(s.amount_paid ?? 0)}</td>
                    <td className="inv-report-doc__num">{reportMoney(s.amount_due ?? 0)}</td>
                    <td>{paymentLabel(s.payment_method)}</td>
                    <td>{s.seller || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Totales ({totals.count ?? sales.length})</td>
                  <td className="inv-report-doc__num">{reportMoney(totals.revenue ?? 0)}</td>
                  <td className="inv-report-doc__num">{reportMoney(totals.cost ?? 0)}</td>
                  <td className="inv-report-doc__num">{reportMoney(totals.profit ?? 0)}</td>
                  <td className="inv-report-doc__num">{reportMoney(totals.collected ?? 0)}</td>
                  <td className="inv-report-doc__num">{reportMoney(totals.pending ?? 0)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </ReportPreviewSection>
      )}

      {methodEntries.length > 0 && (
        <ReportPreviewSection title="Cobros del período por método (fecha de pago)">
          <div className="inv-report-doc__table-wrap inv-report-doc__table-wrap--compact">
            <table className="inv-report-doc__table inv-report-doc__table--compact">
              <thead>
                <tr>
                  <th>Método</th>
                  <th className="inv-report-doc__th-num">Monto</th>
                </tr>
              </thead>
              <tbody>
                {methodEntries.map(([method, amount]) => (
                  <tr key={method}>
                    <td>{paymentLabel(method)}</td>
                    <td className="inv-report-doc__num">{reportMoney(amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total cobrado</td>
                  <td className="inv-report-doc__num">
                    {reportMoney(
                      totals.collected_in_period ?? methodEntries.reduce((s, [, a]) => s + Number(a), 0),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ReportPreviewSection>
      )}

      <ReportPreviewFooter />
    </div>
  );
}

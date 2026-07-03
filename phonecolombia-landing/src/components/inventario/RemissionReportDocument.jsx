import {
  ReportPreviewEmpty,
  ReportPreviewFooter,
  ReportPreviewHeader,
  ReportPreviewKpis,
  ReportPreviewMethodology,
  ReportPreviewSection,
  ReportPreviewSellerBlock,
  formatDateLabel,
  paymentLabel,
  reportMoney,
} from "./ReportPreviewParts.jsx";

function formatDocumentAt(value, showDate) {
  if (!value) return "—";
  const d = new Date(value);
  if (showDate) {
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  }
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(rem) {
  return rem.status_label || rem.status || "—";
}

export default function RemissionReportDocument({ report, from, to, generatedAt }) {
  const remissions = report?.remissions || [];
  const totals = report?.totals || {};
  const showDate = Boolean(report?.is_range);
  const periodFrom = from || report?.period_from;
  const periodTo = to || report?.period_to;
  const periodLabel = periodFrom && periodTo && periodFrom !== periodTo
    ? `${formatDateLabel(periodFrom)} — ${formatDateLabel(periodTo)}`
    : formatDateLabel(periodTo || periodFrom);

  const kpis = [
    { label: "Remisiones", value: totals.count ?? 0, tone: "blue" },
    { label: "Ingresos", value: reportMoney(totals.revenue), tone: "purple" },
    { label: "Pagado", value: reportMoney(totals.collected), tone: "green" },
    ...(totals.pending > 0 ? [{ label: "Pendiente", value: reportMoney(totals.pending), tone: "orange" }] : []),
    { label: "Costo total", value: reportMoney(totals.cost), tone: "slate" },
    { label: "Utilidad bruta", value: reportMoney(totals.profit), tone: "green" },
    { label: "Margen", value: totals.margin_percent != null ? `${totals.margin_percent}%` : "—", tone: "amber" },
    { label: "Entregadas", value: totals.entregados ?? 0, tone: "slate" },
    { label: "Apartados", value: totals.apartados ?? 0, tone: "purple" },
  ];

  return (
    <div className="inv-report-doc">
      <ReportPreviewHeader
        docLabel="Informe por remisión"
        docSubtitle={`${totals.count ?? 0} remisión${(totals.count ?? 0) === 1 ? "" : "es"} en el período`}
        periodLabel={periodLabel}
        generatedAt={generatedAt}
      />

      <ReportPreviewKpis items={kpis} />
      <ReportPreviewMethodology text={report?.methodology} />

      {remissions.length === 0 ? (
        <ReportPreviewEmpty>
          No hay remisiones en este período con los filtros aplicados.
        </ReportPreviewEmpty>
      ) : (
        <ReportPreviewSection title="Detalle por remisión" className="inv-report-doc__section--detail">
          {remissions.map((rem) => (
            <ReportPreviewSellerBlock
              key={rem.sale_id || rem.remission_number}
              title={`${rem.remission_number || "—"} · ${statusLabel(rem)}`}
              meta={[
                formatDocumentAt(rem.document_date, showDate),
                rem.customer,
                rem.customer_phone,
                rem.seller,
              ].filter(Boolean).join(" · ")}
            >
              <div className="inv-report-doc__table-wrap">
                <table className="inv-report-doc__table">
                  <thead>
                    <tr>
                      <th>Equipo</th>
                      <th>IMEI</th>
                      <th className="inv-report-doc__th-num">Precio venta</th>
                      <th className="inv-report-doc__th-num">Costo</th>
                      <th className="inv-report-doc__th-num">Utilidad</th>
                      <th className="inv-report-doc__th-num">Pagado</th>
                      <th className="inv-report-doc__th-num">Pendiente</th>
                      <th>Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{rem.item || "—"}</td>
                      <td className="inv-cell-mono">{rem.imei || rem.barcode || "—"}</td>
                      <td className="inv-report-doc__num">{reportMoney(rem.sale_price_num ?? rem.sale_price)}</td>
                      <td className="inv-report-doc__num">{reportMoney(rem.purchase_price_num ?? 0)}</td>
                      <td className="inv-report-doc__num inv-report-doc__num--profit">{reportMoney(rem.net_profit ?? 0)}</td>
                      <td className="inv-report-doc__num">{reportMoney(rem.amount_paid ?? 0)}</td>
                      <td className="inv-report-doc__num">{reportMoney(rem.amount_due ?? 0)}</td>
                      <td>
                        {paymentLabel(rem.payment_method)}
                        {rem.credit_payment_method ? ` · ${rem.credit_payment_method}` : ""}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {rem.payments?.length > 0 ? (
                <div className="inv-report-doc__table-wrap" style={{ marginTop: "0.75rem" }}>
                  <p className="inv-report-doc__seller-meta" style={{ marginBottom: "0.35rem", fontWeight: 600 }}>
                    Pagos de la remisión
                  </p>
                  <table className="inv-report-doc__table">
                    <thead>
                      <tr>
                        <th>{showDate ? "Fecha" : "Hora"}</th>
                        <th>Método</th>
                        <th className="inv-report-doc__th-num">Monto</th>
                        <th>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rem.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatDocumentAt(payment.paid_at, showDate)}</td>
                          <td>{payment.method_label || paymentLabel(payment.method)}</td>
                          <td className="inv-report-doc__num">{reportMoney(payment.amount)}</td>
                          <td>{payment.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ReportPreviewEmpty>Sin pagos registrados.</ReportPreviewEmpty>
              )}

              {rem.notes?.trim() && (
                <p className="inv-report-doc__seller-meta" style={{ marginTop: "0.75rem" }}>
                  <strong>Notas:</strong> {rem.notes.trim()}
                </p>
              )}
            </ReportPreviewSellerBlock>
          ))}
        </ReportPreviewSection>
      )}

      <ReportPreviewFooter />
    </div>
  );
}

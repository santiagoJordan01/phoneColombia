import {
  ReportPreviewEmpty,
  ReportPreviewFooter,
  ReportPreviewHeader,
  ReportPreviewKpis,
  ReportPreviewMethodology,
  ReportPreviewSection,
  reportMoney,
} from "./ReportPreviewParts.jsx";

function formatDueDate(dueAt, daysOverdue, isOverdue) {
  if (!dueAt) return "—";
  const label = new Date(dueAt).toLocaleDateString("es-CO");
  if (isOverdue && daysOverdue > 0) return `${label} (${daysOverdue}d)`;
  return label;
}

function formatAsOfLabel(asOf, generatedAt) {
  if (asOf) {
    return new Date(asOf).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
  }
  return generatedAt || "—";
}

export default function ReceivablesReportDocument({ report, generatedAt }) {
  const totals = report?.totals || {};
  const items = report?.items || [];
  const periodLabel = `Al corte de ${formatAsOfLabel(report?.as_of, generatedAt)}`;

  const kpis = [
    { label: "Cuentas con saldo", value: totals.count ?? 0, tone: "blue" },
    { label: "Pendiente total", value: reportMoney(totals.total_due), tone: "amber" },
    { label: "Total pagado", value: reportMoney(totals.total_paid), tone: "green" },
    { label: "Apartados", value: totals.apartados_count ?? 0, tone: "purple" },
    { label: "Saldo apartados", value: reportMoney(totals.apartados_due), tone: "purple" },
    { label: "Créditos", value: totals.creditos_count ?? 0, tone: "slate" },
    { label: "Saldo créditos", value: reportMoney(totals.creditos_due), tone: "slate" },
  ];
  if ((totals.overdue_count ?? 0) > 0) {
    kpis.push({
      label: `Vencidos (${totals.overdue_count})`,
      value: reportMoney(totals.overdue_amount),
      tone: "orange",
    });
  }
  kpis.push(
    { label: "Valor ventas", value: reportMoney(totals.revenue), tone: "purple" },
    { label: "Costo total", value: reportMoney(totals.total_cost), tone: "slate" },
    { label: "Utilidad bruta", value: reportMoney(totals.total_profit), tone: "green" },
    {
      label: "Margen",
      value: totals.margin_percent != null ? `${totals.margin_percent}%` : "—",
      tone: "amber",
    },
  );

  return (
    <div className="inv-report-doc">
      <ReportPreviewHeader
        docLabel="Informe de cartera"
        docSubtitle="Apartados y créditos pendientes"
        periodLabel={periodLabel}
        generatedAt={generatedAt}
      />

      <ReportPreviewKpis items={kpis} />
      <ReportPreviewMethodology text={report?.methodology} />

      <ReportPreviewSection title="Detalle de cartera">
        {!items.length ? (
          <ReportPreviewEmpty>No hay saldos pendientes por cobrar con los filtros aplicados.</ReportPreviewEmpty>
        ) : (
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table inv-report-doc__table--ledger">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Remisión</th>
                  <th>Equipo</th>
                  <th>Cliente</th>
                  <th className="inv-report-doc__th-num">Total</th>
                  <th className="inv-report-doc__th-num">Pagado</th>
                  <th className="inv-report-doc__th-num">Pendiente</th>
                  <th>Vence</th>
                  <th>Vendedor</th>
                  <th>Financiera</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.type_label || row.type || "—"}</td>
                    <td className="inv-cell-mono">{row.remission_number || "—"}</td>
                    <td>{row.item || "—"}</td>
                    <td>
                      {row.customer || "—"}
                      {row.customer_phone ? ` · ${row.customer_phone}` : ""}
                    </td>
                    <td className="inv-report-doc__num">{reportMoney(row.sale_price)}</td>
                    <td className="inv-report-doc__num">{reportMoney(row.amount_paid)}</td>
                    <td className="inv-report-doc__num inv-report-doc__num--profit">{reportMoney(row.amount_due)}</td>
                    <td>{formatDueDate(row.due_at, row.days_overdue, row.is_overdue)}</td>
                    <td>{row.seller || "—"}</td>
                    <td>{row.credit_payment_method || "—"}</td>
                    <td className={row.is_overdue ? "inv-report-doc__num--out" : "inv-report-doc__num--profit"}>
                      {row.is_overdue ? "Vencido" : "Al día"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Totales ({totals.count ?? items.length})</td>
                  <td className="inv-report-doc__num">
                    {reportMoney(items.reduce((sum, row) => sum + Number(row.sale_price ?? 0), 0))}
                  </td>
                  <td className="inv-report-doc__num">{reportMoney(totals.total_paid)}</td>
                  <td className="inv-report-doc__num">{reportMoney(totals.total_due)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </ReportPreviewSection>

      <ReportPreviewFooter />
    </div>
  );
}

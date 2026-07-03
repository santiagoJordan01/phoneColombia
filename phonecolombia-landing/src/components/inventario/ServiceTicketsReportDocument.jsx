import {
  ReportPreviewEmpty,
  ReportPreviewFooter,
  ReportPreviewHeader,
  ReportPreviewKpis,
  ReportPreviewMethodology,
  ReportPreviewSection,
  formatMargin,
  reportMoney,
} from "./ReportPreviewParts.jsx";

function formatTicketAt(value, showDate) {
  if (!value) return "—";
  const d = new Date(value);
  if (showDate) {
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  }
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

export default function ServiceTicketsReportDocument({ report, generatedAt }) {
  const totals = report?.totals || {};
  const tickets = report?.tickets || [];
  const byStatus = report?.by_status || [];
  const byTechnician = report?.by_technician || [];
  const showDate = Boolean(report?.is_range);
  const periodLabel = report?.period_from === report?.period_to
    ? report?.period_from
    : `${report?.period_from} — ${report?.period_to}`;

  const kpis = [
    { label: "Tickets", value: totals.count ?? 0, tone: "blue" },
    { label: "Abiertos", value: totals.open_count ?? 0, tone: "amber" },
    { label: "Cerrados", value: totals.closed_count ?? 0, tone: "green" },
    { label: "Costo reparación", value: reportMoney(totals.repair_cost), tone: "slate" },
    { label: "Precio al cliente", value: reportMoney(totals.customer_price), tone: "purple" },
    { label: "Margen", value: reportMoney(totals.margin), tone: "green" },
    {
      label: "Margen %",
      value: totals.margin_percent != null ? formatMargin(totals.margin_percent) : "—",
      tone: "amber",
    },
  ];

  return (
    <div className="inv-report-doc">
      <ReportPreviewHeader
        docLabel="Servicio técnico"
        docSubtitle="Tickets recibidos en el período"
        periodLabel={periodLabel}
        generatedAt={generatedAt}
      />

      <ReportPreviewKpis items={kpis} />
      <ReportPreviewMethodology text={report?.methodology} />

      {byStatus.length > 0 && (
        <ReportPreviewSection title="Por estado">
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th className="inv-report-doc__th-num">Tickets</th>
                  <th className="inv-report-doc__th-num">Costo</th>
                  <th className="inv-report-doc__th-num">Precio cliente</th>
                </tr>
              </thead>
              <tbody>
                {byStatus.map((row) => (
                  <tr key={row.status}>
                    <td>{row.status_label || row.status || "—"}</td>
                    <td className="inv-report-doc__num">{row.count ?? 0}</td>
                    <td className="inv-report-doc__num">{reportMoney(row.repair_cost)}</td>
                    <td className="inv-report-doc__num">{reportMoney(row.customer_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportPreviewSection>
      )}

      {byTechnician.length > 0 && (
        <ReportPreviewSection title="Por técnico">
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table">
              <thead>
                <tr>
                  <th>Técnico</th>
                  <th className="inv-report-doc__th-num">Tickets</th>
                  <th className="inv-report-doc__th-num">Costo</th>
                  <th className="inv-report-doc__th-num">Precio cliente</th>
                </tr>
              </thead>
              <tbody>
                {byTechnician.map((row) => (
                  <tr key={row.technician_key || row.technician}>
                    <td>{row.technician || "—"}</td>
                    <td className="inv-report-doc__num">{row.count ?? 0}</td>
                    <td className="inv-report-doc__num">{reportMoney(row.repair_cost)}</td>
                    <td className="inv-report-doc__num">{reportMoney(row.customer_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportPreviewSection>
      )}

      <ReportPreviewSection title="Detalle de tickets">
        {!tickets.length ? (
          <ReportPreviewEmpty>No hay tickets en este período con los filtros aplicados.</ReportPreviewEmpty>
        ) : (
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table inv-report-doc__table--ledger">
              <thead>
                <tr>
                  <th>{showDate ? "Recibido" : "Hora"}</th>
                  <th>Equipo</th>
                  <th>Referencia</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Técnico</th>
                  <th className="inv-report-doc__th-num">Costo</th>
                  <th className="inv-report-doc__th-num">Precio</th>
                  <th className="inv-report-doc__th-num">Margen</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{formatTicketAt(ticket.received_at, showDate)}</td>
                    <td>{ticket.display_name || "—"}</td>
                    <td className="inv-cell-mono">{ticket.device_reference || ticket.imei || "—"}</td>
                    <td>{ticket.ticket_type_label || ticket.ticket_type || "—"}</td>
                    <td>{ticket.customer_name || "—"}</td>
                    <td>{ticket.status_label || ticket.status || "—"}</td>
                    <td>{ticket.technician || "—"}</td>
                    <td className="inv-report-doc__num">{reportMoney(ticket.repair_cost)}</td>
                    <td className="inv-report-doc__num">{reportMoney(ticket.customer_price)}</td>
                    <td className="inv-report-doc__num">{reportMoney(ticket.margin)}</td>
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

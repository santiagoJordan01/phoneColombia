import { formatPrice } from "../../pages/inventario/shared.jsx";

function formatDateLabel(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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

  return (
    <div className="inv-report-doc">
      <header className="inv-report-doc__header">
        <h1 className="inv-report-doc__title">Phone Colombia — Informe diario de ventas</h1>
        <p className="inv-report-doc__meta">
          Período: <strong>{periodLabel}</strong>
          {generatedAt && <> · Generado: {generatedAt}</>}
        </p>
      </header>

      <div className="inv-report-doc__summary">
        Ventas: <strong>{totals.count ?? 0}</strong>
        {" · "}
        Recaudado: <strong>{formatPrice(totals.collected ?? 0)}</strong>
        {" · "}
        Pendiente: <strong>{formatPrice(totals.pending ?? 0)}</strong>
      </div>

      {sales.length === 0 ? (
        <p className="inv-report-doc__empty">No hay ventas registradas para este período con los filtros aplicados.</p>
      ) : (
        <table className="inv-report-doc__table">
          <thead>
            <tr>
              <th>{isRange ? "Fecha" : "Hora"}</th>
              <th>Equipo</th>
              <th>IMEI</th>
              <th>Precio</th>
              <th>Método</th>
              <th>Vendedor</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{saleWhen(s.sold_at)}</td>
                <td>{s.item || "—"}</td>
                <td className="inv-cell-mono">{s.imei || "—"}</td>
                <td>{formatPrice(s.sale_price)}</td>
                <td>{s.payment_method || "—"}</td>
                <td>{s.seller || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {methodEntries.length > 0 && (
        <section className="inv-report-doc__methods">
          <h2>Recaudo por método de pago</h2>
          <table className="inv-report-doc__table inv-report-doc__table--compact">
            <thead>
              <tr>
                <th>Método</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {methodEntries.map(([method, amount]) => (
                <tr key={method}>
                  <td>{method}</td>
                  <td>{formatPrice(amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="inv-report-doc__footer">
        Documento generado automáticamente por Phone Colombia Inventario
      </footer>
    </div>
  );
}

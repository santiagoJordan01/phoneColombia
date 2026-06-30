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

function formatMargin(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
}

const PAYMENT_LABELS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  credito: "Crédito",
  mixto: "Mixto",
};

function paymentLabel(method) {
  return PAYMENT_LABELS[method] ?? method ?? "—";
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
        <h1 className="inv-report-doc__title">Phone Colombia — Informe de ventas</h1>
        <p className="inv-report-doc__meta">
          Período: <strong>{periodLabel}</strong>
          {generatedAt && <> · Generado: {generatedAt}</>}
        </p>
      </header>

      <div className="inv-report-doc__summary">
        Ventas: <strong>{totals.count ?? 0}</strong>
        {" · "}
        Ingresos: <strong>{formatPrice(totals.revenue ?? 0)}</strong>
        {" · "}
        Costo: <strong>{formatPrice(totals.cost ?? 0)}</strong>
        {" · "}
        Utilidad bruta: <strong>{formatPrice(totals.profit ?? 0)}</strong>
        {" · "}
        Margen: <strong>{formatMargin(totals.margin_percent)}</strong>
        {" · "}
        Recaudado: <strong>{formatPrice(totals.collected ?? 0)}</strong>
        {" · "}
        Pendiente: <strong>{formatPrice(totals.pending ?? 0)}</strong>
      </div>

      {report?.methodology && (
        <p className="inv-dash__muted" style={{ margin: "0 0 1rem", fontSize: "0.85rem" }}>{report.methodology}</p>
      )}

      {sales.length === 0 ? (
        <p className="inv-report-doc__empty">No hay ventas registradas para este período con los filtros aplicados.</p>
      ) : (
        <table className="inv-report-doc__table">
          <thead>
            <tr>
              <th>{isRange ? "Fecha" : "Hora"}</th>
              <th>Equipo</th>
              <th>IMEI</th>
              <th>Venta</th>
              <th>Costo</th>
              <th>Utilidad</th>
              <th>Pagado</th>
              <th>Pendiente</th>
              <th>Método</th>
              <th>Vendedor</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{saleWhen(s.sold_at)}</td>
                <td>{s.item || "—"}</td>
                <td className="inv-cell-mono">{s.imei || s.barcode || "—"}</td>
                <td>{formatPrice(s.sale_price_num ?? s.sale_price)}</td>
                <td>{formatPrice(s.purchase_price_num ?? 0)}</td>
                <td>{formatPrice(s.net_profit ?? 0)}</td>
                <td>{formatPrice(s.amount_paid ?? 0)}</td>
                <td>{formatPrice(s.amount_due ?? 0)}</td>
                <td>{paymentLabel(s.payment_method)}</td>
                <td>{s.seller || "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Totales ({totals.count ?? sales.length})</td>
              <td>{formatPrice(totals.revenue ?? 0)}</td>
              <td>{formatPrice(totals.cost ?? 0)}</td>
              <td>{formatPrice(totals.profit ?? 0)}</td>
              <td>{formatPrice(totals.collected ?? 0)}</td>
              <td>{formatPrice(totals.pending ?? 0)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      )}

      {methodEntries.length > 0 && (
        <section className="inv-report-doc__methods">
          <h2>Cobros registrados por método de pago</h2>
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
                  <td>{paymentLabel(method)}</td>
                  <td>{formatPrice(amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total cobrado</td>
                <td>{formatPrice(totals.collected ?? methodEntries.reduce((s, [, a]) => s + Number(a), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <footer className="inv-report-doc__footer">
        Documento gerencial. No incluye impuestos ni gastos operativos.
      </footer>
    </div>
  );
}

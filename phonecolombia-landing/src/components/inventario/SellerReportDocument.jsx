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

function formatSoldAt(soldAt) {
  if (!soldAt) return "—";
  return new Date(soldAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function formatMargin(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
}

export default function SellerReportDocument({ report, from, to, generatedAt }) {
  const sellers = report?.sellers || [];
  const totals = report?.totals || {};
  const periodFrom = from || report?.period_from;
  const periodTo = to || report?.period_to;
  const periodLabel = periodFrom && periodTo && periodFrom !== periodTo
    ? `${formatDateLabel(periodFrom)} — ${formatDateLabel(periodTo)}`
    : formatDateLabel(periodTo || periodFrom);

  return (
    <div className="inv-report-doc">
      <header className="inv-report-doc__header">
        <h1 className="inv-report-doc__title">Phone Colombia — Informe por vendedor</h1>
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

      {sellers.length === 0 ? (
        <p className="inv-report-doc__empty">No hay ventas por vendedor en este período con los filtros aplicados.</p>
      ) : (
        <>
          <section className="inv-report-doc__methods">
            <h2>Resumen por vendedor</h2>
            <table className="inv-report-doc__table inv-report-doc__table--compact">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Ventas</th>
                  <th>Ingresos</th>
                  <th>Costo</th>
                  <th>Utilidad</th>
                  <th>Margen</th>
                  <th>Recaudado</th>
                  <th>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((group) => (
                  <tr key={group.seller_id || group.seller}>
                    <td>{group.seller || "Sin vendedor"}</td>
                    <td>{group.count ?? 0}</td>
                    <td>{formatPrice(group.revenue ?? 0)}</td>
                    <td>{formatPrice(group.cost ?? 0)}</td>
                    <td>{formatPrice(group.profit ?? 0)}</td>
                    <td>{formatMargin(group.margin_percent)}</td>
                    <td>{formatPrice(group.collected ?? 0)}</td>
                    <td>{formatPrice(group.pending ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total general</td>
                  <td>{totals.count ?? 0}</td>
                  <td>{formatPrice(totals.revenue ?? 0)}</td>
                  <td>{formatPrice(totals.cost ?? 0)}</td>
                  <td>{formatPrice(totals.profit ?? 0)}</td>
                  <td>{formatMargin(totals.margin_percent)}</td>
                  <td>{formatPrice(totals.collected ?? 0)}</td>
                  <td>{formatPrice(totals.pending ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {sellers.map((group) => (
            <section key={group.seller_id || group.seller} style={{ marginTop: "1.75rem" }}>
              <h2 className="inv-panel__subtitle" style={{ marginBottom: "0.35rem" }}>
                {group.seller || "Sin vendedor"}
              </h2>
              <p className="inv-dash__muted" style={{ margin: "0 0 0.75rem" }}>
                {group.count ?? 0} ventas · Ingresos {formatPrice(group.revenue ?? 0)} · Utilidad {formatPrice(group.profit ?? 0)}
                {group.margin_percent != null && ` · Margen ${formatMargin(group.margin_percent)}`}
              </p>
              {!group.sales?.length ? (
                <p className="inv-report-doc__empty">Sin ventas.</p>
              ) : (
                <table className="inv-report-doc__table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Equipo</th>
                      <th>IMEI</th>
                      <th>Precio venta</th>
                      <th>Costo</th>
                      <th>Utilidad</th>
                      <th>Pagado</th>
                      <th>Pendiente</th>
                      <th>Método</th>
                      <th>Cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.sales.map((sale) => (
                      <tr key={sale.id}>
                        <td>{formatSoldAt(sale.sold_at)}</td>
                        <td>{sale.item || "—"}</td>
                        <td className="inv-cell-mono">{sale.imei || sale.barcode || "—"}</td>
                        <td>{formatPrice(sale.sale_price_num ?? sale.sale_price)}</td>
                        <td>{formatPrice(sale.purchase_price_num ?? 0)}</td>
                        <td>{formatPrice(sale.net_profit ?? 0)}</td>
                        <td>{formatPrice(sale.amount_paid ?? 0)}</td>
                        <td>{formatPrice(sale.amount_due ?? 0)}</td>
                        <td>{sale.payment_method || "—"}</td>
                        <td>{sale.customer || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Subtotal ({group.count ?? group.sales.length})</td>
                      <td>{formatPrice(group.revenue ?? 0)}</td>
                      <td>{formatPrice(group.cost ?? 0)}</td>
                      <td>{formatPrice(group.profit ?? 0)}</td>
                      <td>{formatPrice(group.collected ?? 0)}</td>
                      <td>{formatPrice(group.pending ?? 0)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>
          ))}
        </>
      )}

      <footer className="inv-report-doc__footer">
        Documento gerencial. No incluye impuestos ni gastos operativos.
      </footer>
    </div>
  );
}

import {
  ReportPreviewEmpty,
  ReportPreviewFooter,
  ReportPreviewHeader,
  ReportPreviewKpis,
  ReportPreviewMethodology,
  ReportPreviewSection,
  ReportPreviewSellerBlock,
  formatDateLabel,
  formatMargin,
  formatSoldAt,
  paymentLabel,
  reportMoney,
} from "./ReportPreviewParts.jsx";

export default function SellerReportDocument({ report, from, to, generatedAt }) {
  const sellers = report?.sellers || [];
  const totals = report?.totals || {};
  const periodFrom = from || report?.period_from;
  const periodTo = to || report?.period_to;
  const periodLabel = periodFrom && periodTo && periodFrom !== periodTo
    ? `${formatDateLabel(periodFrom)} — ${formatDateLabel(periodTo)}`
    : formatDateLabel(periodTo || periodFrom);

  const kpis = [
    { label: "Ventas", value: totals.count ?? 0, tone: "blue" },
    { label: "Ingresos", value: reportMoney(totals.revenue), tone: "purple" },
    { label: "Costo total", value: reportMoney(totals.cost), tone: "slate" },
    { label: "Utilidad bruta", value: reportMoney(totals.profit), tone: "green" },
    { label: "Margen", value: formatMargin(totals.margin_percent), tone: "amber" },
    { label: "Recaudado", value: reportMoney(totals.collected), tone: "green" },
    ...(totals.pending > 0 ? [{ label: "Pendiente", value: reportMoney(totals.pending), tone: "orange" }] : []),
  ];

  return (
    <div className="inv-report-doc">
      <ReportPreviewHeader
        docLabel="Informe por vendedor"
        docSubtitle={`${sellers.length} vendedor${sellers.length === 1 ? "" : "es"} en el período`}
        periodLabel={periodLabel}
        generatedAt={generatedAt}
      />

      <ReportPreviewKpis items={kpis} />
      <ReportPreviewMethodology text={report?.methodology} />

      {sellers.length === 0 ? (
        <ReportPreviewEmpty>
          No hay ventas por vendedor en este período con los filtros aplicados.
        </ReportPreviewEmpty>
      ) : (
        <>
          <ReportPreviewSection title="Resumen por vendedor">
            <div className="inv-report-doc__table-wrap">
              <table className="inv-report-doc__table">
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th className="inv-report-doc__th-num">Ventas</th>
                    <th className="inv-report-doc__th-num">Ingresos</th>
                    <th className="inv-report-doc__th-num">Costo</th>
                    <th className="inv-report-doc__th-num">Utilidad</th>
                    <th className="inv-report-doc__th-num">Margen</th>
                    <th className="inv-report-doc__th-num">Recaudado</th>
                    <th className="inv-report-doc__th-num">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((group) => (
                    <tr key={group.seller_id || group.seller}>
                      <td className="inv-report-doc__seller-cell">{group.seller || "Sin vendedor"}</td>
                      <td className="inv-report-doc__num">{group.count ?? 0}</td>
                      <td className="inv-report-doc__num">{reportMoney(group.revenue ?? 0)}</td>
                      <td className="inv-report-doc__num">{reportMoney(group.cost ?? 0)}</td>
                      <td className="inv-report-doc__num inv-report-doc__num--profit">{reportMoney(group.profit ?? 0)}</td>
                      <td className="inv-report-doc__num">{formatMargin(group.margin_percent)}</td>
                      <td className="inv-report-doc__num">{reportMoney(group.collected ?? 0)}</td>
                      <td className="inv-report-doc__num">{reportMoney(group.pending ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total general</td>
                    <td className="inv-report-doc__num">{totals.count ?? 0}</td>
                    <td className="inv-report-doc__num">{reportMoney(totals.revenue ?? 0)}</td>
                    <td className="inv-report-doc__num">{reportMoney(totals.cost ?? 0)}</td>
                    <td className="inv-report-doc__num">{reportMoney(totals.profit ?? 0)}</td>
                    <td className="inv-report-doc__num">{formatMargin(totals.margin_percent)}</td>
                    <td className="inv-report-doc__num">{reportMoney(totals.collected ?? 0)}</td>
                    <td className="inv-report-doc__num">{reportMoney(totals.pending ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ReportPreviewSection>

          <ReportPreviewSection title="Detalle por vendedor" className="inv-report-doc__section--detail">
            {sellers.map((group) => (
              <ReportPreviewSellerBlock
                key={group.seller_id || group.seller}
                title={group.seller || "Sin vendedor"}
                meta={`${group.count ?? 0} ventas · Ingresos ${reportMoney(group.revenue ?? 0)} · Utilidad ${reportMoney(group.profit ?? 0)}${group.margin_percent != null ? ` · Margen ${formatMargin(group.margin_percent)}` : ""}`}
              >
                {!group.sales?.length ? (
                  <ReportPreviewEmpty>Sin ventas.</ReportPreviewEmpty>
                ) : (
                  <div className="inv-report-doc__table-wrap">
                    <table className="inv-report-doc__table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Equipo</th>
                          <th>IMEI</th>
                          <th className="inv-report-doc__th-num">Precio venta</th>
                          <th className="inv-report-doc__th-num">Costo</th>
                          <th className="inv-report-doc__th-num">Utilidad</th>
                          <th className="inv-report-doc__th-num">Pagado</th>
                          <th className="inv-report-doc__th-num">Pendiente</th>
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
                            <td className="inv-report-doc__num">{reportMoney(sale.sale_price_num ?? sale.sale_price)}</td>
                            <td className="inv-report-doc__num">{reportMoney(sale.purchase_price_num ?? 0)}</td>
                            <td className="inv-report-doc__num inv-report-doc__num--profit">{reportMoney(sale.net_profit ?? 0)}</td>
                            <td className="inv-report-doc__num">{reportMoney(sale.amount_paid ?? 0)}</td>
                            <td className="inv-report-doc__num">{reportMoney(sale.amount_due ?? 0)}</td>
                            <td>{paymentLabel(sale.payment_method)}</td>
                            <td>{sale.customer || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3}>Subtotal ({group.count ?? group.sales.length})</td>
                          <td className="inv-report-doc__num">{reportMoney(group.revenue ?? 0)}</td>
                          <td className="inv-report-doc__num">{reportMoney(group.cost ?? 0)}</td>
                          <td className="inv-report-doc__num">{reportMoney(group.profit ?? 0)}</td>
                          <td className="inv-report-doc__num">{reportMoney(group.collected ?? 0)}</td>
                          <td className="inv-report-doc__num">{reportMoney(group.pending ?? 0)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </ReportPreviewSellerBlock>
            ))}
          </ReportPreviewSection>
        </>
      )}

      <ReportPreviewFooter />
    </div>
  );
}

import {
  ReportPreviewEmpty,
  ReportPreviewFooter,
  ReportPreviewHeader,
  ReportPreviewKpis,
  ReportPreviewMethodology,
  ReportPreviewSection,
  reportMoney,
} from "./ReportPreviewParts.jsx";

function formatAcquiredAt(value, showDate) {
  if (!value) return "—";
  const d = new Date(value);
  if (showDate) {
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  }
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

export default function InventoryIntakeReportDocument({ report, generatedAt }) {
  const totals = report?.totals || {};
  const groups = report?.by_supplier || [];
  const items = report?.items || [];
  const showDate = Boolean(report?.is_range);
  const periodLabel = report?.period_from === report?.period_to
    ? report?.period_from
    : `${report?.period_from} — ${report?.period_to}`;

  const kpis = [
    { label: "Equipos ingresados", value: totals.count ?? 0, tone: "blue" },
    { label: "Costo total compra", value: reportMoney(totals.purchase_total), tone: "slate" },
    { label: "Valor venta referencia", value: reportMoney(totals.sale_value_total), tone: "purple" },
    { label: "Proveedores", value: totals.supplier_count ?? 0, tone: "green" },
  ];

  return (
    <div className="inv-report-doc">
      <ReportPreviewHeader
        docLabel="Ingresos al inventario"
        docSubtitle="Equipos dados de alta por fecha de ingreso"
        periodLabel={periodLabel}
        generatedAt={generatedAt}
      />

      <ReportPreviewKpis items={kpis} />
      <ReportPreviewMethodology text={report?.methodology} />

      {groups.length > 0 && (
        <ReportPreviewSection title="Resumen por proveedor">
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th className="inv-report-doc__th-num">Cantidad</th>
                  <th className="inv-report-doc__th-num">Costo compra</th>
                  <th className="inv-report-doc__th-num">Valor venta</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.supplier_key || group.supplier_name}>
                    <td>{group.supplier_name || "—"}</td>
                    <td className="inv-report-doc__num">{group.count ?? 0}</td>
                    <td className="inv-report-doc__num">{reportMoney(group.purchase_total)}</td>
                    <td className="inv-report-doc__num">{reportMoney(group.sale_value_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportPreviewSection>
      )}

      <ReportPreviewSection title="Detalle de ingresos">
        {!items.length ? (
          <ReportPreviewEmpty>No hay equipos ingresados en este período con los filtros aplicados.</ReportPreviewEmpty>
        ) : (
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table inv-report-doc__table--ledger">
              <thead>
                <tr>
                  <th>{showDate ? "Fecha ingreso" : "Hora"}</th>
                  <th>Equipo</th>
                  <th>IMEI / Código</th>
                  <th>Color</th>
                  <th>Proveedor</th>
                  <th className="inv-report-doc__th-num">Costo</th>
                  <th className="inv-report-doc__th-num">Precio venta</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatAcquiredAt(item.acquired_at, showDate)}</td>
                    <td>{item.name || "—"}</td>
                    <td className="inv-cell-mono">{item.imei || item.barcode || "—"}</td>
                    <td>{item.color || "—"}</td>
                    <td>{item.supplier || "—"}</td>
                    <td className="inv-report-doc__num">{reportMoney(item.purchase_price)}</td>
                    <td className="inv-report-doc__num">{reportMoney(item.sale_price)}</td>
                    <td>{item.status_label || item.status || "—"}</td>
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

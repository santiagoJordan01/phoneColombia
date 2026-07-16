import {
  ReportPreviewEmpty,
  ReportPreviewFooter,
  ReportPreviewHeader,
  ReportPreviewMethodology,
  ReportPreviewSection,
  formatDateLabel,
  reportMoney,
} from "./ReportPreviewParts.jsx";

export default function DailySettlementDocument({ report, from, to, generatedAt }) {
  const periodFrom = from || report?.period_from;
  const periodTo = to || report?.period_to;
  const isRange = report?.is_range ?? (periodFrom && periodTo && periodFrom !== periodTo);
  const periodLabel = report?.fecha
    || (periodFrom && periodTo && periodFrom !== periodTo
      ? `${formatDateLabel(periodFrom)} — ${formatDateLabel(periodTo)}`
      : formatDateLabel(periodTo || periodFrom));

  const formas = Array.isArray(report?.formas_de_pago) ? report.formas_de_pago : [];
  const equipos = Array.isArray(report?.equipos_vendidos) ? report.equipos_vendidos : [];
  const movimientos = Array.isArray(report?.movimientos_caja) ? report.movimientos_caja : [];
  const diferencia = Number(report?.diferencia ?? 0);
  const totalIngresos = Number(report?.total_ingresos ?? 0);
  const totalEgresos = Number(report?.total_egresos ?? 0);
  const netoCaja = Number(report?.neto_caja ?? (totalIngresos - totalEgresos));

  return (
    <div className="inv-report-doc">
      <ReportPreviewHeader
        docLabel="Cuadre de caja"
        docSubtitle={isRange ? "Cuadre del período" : "Cuadre del día"}
        periodLabel={periodLabel}
        generatedAt={generatedAt}
      />

      <div className="inv-report-doc__kpis">
        <article className="inv-report-doc__kpi" style={{ "--kpi-accent": "#1e3a5f" }}>
          <span className="inv-report-doc__kpi-label">Fecha</span>
          <strong className="inv-report-doc__kpi-value" style={{ fontSize: "1rem" }}>{periodLabel}</strong>
        </article>
        <article className="inv-report-doc__kpi" style={{ "--kpi-accent": "#7c3aed" }}>
          <span className="inv-report-doc__kpi-label">Ventas netas</span>
          <strong className="inv-report-doc__kpi-value">{reportMoney(report?.ventas_netas)}</strong>
        </article>
        <article className="inv-report-doc__kpi" style={{ "--kpi-accent": "#475569" }}>
          <span className="inv-report-doc__kpi-label">Costo</span>
          <strong className="inv-report-doc__kpi-value">{reportMoney(report?.total_costo)}</strong>
        </article>
        <article className="inv-report-doc__kpi" style={{ "--kpi-accent": "#0f766e" }}>
          <span className="inv-report-doc__kpi-label">Utilidad bruta</span>
          <strong className="inv-report-doc__kpi-value">{reportMoney(report?.utilidad_bruta)}</strong>
        </article>
        <article className="inv-report-doc__kpi" style={{ "--kpi-accent": "#0f766e" }}>
          <span className="inv-report-doc__kpi-label">Ingresos de caja</span>
          <strong className="inv-report-doc__kpi-value">{reportMoney(totalIngresos)}</strong>
        </article>
        <article className="inv-report-doc__kpi" style={{ "--kpi-accent": "#b45309" }}>
          <span className="inv-report-doc__kpi-label">Egresos de caja</span>
          <strong className="inv-report-doc__kpi-value">{reportMoney(totalEgresos)}</strong>
        </article>
        <article className="inv-report-doc__kpi" style={{ "--kpi-accent": netoCaja < 0 ? "#b45309" : "#475569" }}>
          <span className="inv-report-doc__kpi-label">Neto de caja</span>
          <strong className="inv-report-doc__kpi-value">{reportMoney(netoCaja)}</strong>
        </article>
      </div>

      <p className="inv-dash__muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Ingresos: cobros {reportMoney(report?.ingresos_cobros ?? report?.ingresos_venta)} + manual {reportMoney(report?.ingresos_manuales)}
        {" · "}
        Egresos: retoma {reportMoney(report?.egresos_retoma)} + manual {reportMoney(report?.egresos_manuales)}
        {" · "}
        Dif. ventas {reportMoney(diferencia)} (precio − cobrado acum. − pendiente)
      </p>

      <ReportPreviewMethodology text={report?.methodology} />

      <ReportPreviewSection title="Formas de pago">
        <div className="inv-report-doc__table-wrap inv-report-doc__table-wrap--compact">
          <table className="inv-report-doc__table inv-report-doc__table--compact">
            <thead>
              <tr>
                <th>Método</th>
                <th className="inv-report-doc__th-num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {formas.map((forma) => (
                <tr key={forma.key || forma.label}>
                  <td>{forma.label}</td>
                  <td className="inv-report-doc__num inv-report-doc__num--profit">{reportMoney(forma.amount)}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Formas de caja (sin crédito)</strong></td>
                <td className="inv-report-doc__num"><strong>{reportMoney(report?.total_formas_caja)}</strong></td>
              </tr>
              <tr>
                <td><strong>Neto de caja (ingresos − egresos)</strong></td>
                <td className="inv-report-doc__num"><strong>{reportMoney(netoCaja)}</strong></td>
              </tr>
              <tr>
                <td><strong>Diferencia ventas (precio − cobrado − pendiente)</strong></td>
                <td className={`inv-report-doc__num${diferencia !== 0 ? " inv-report-doc__num--out" : ""}`}>
                  <strong>{reportMoney(diferencia)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ReportPreviewSection>

      <ReportPreviewSection title={`Equipos vendidos (${equipos.length})`}>
        {!equipos.length ? (
          <ReportPreviewEmpty>No hay equipos vendidos en este período.</ReportPreviewEmpty>
        ) : (
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table inv-report-doc__table--ledger">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Equipo</th>
                  <th>IMEI</th>
                  <th>Proveedor</th>
                  <th className="inv-report-doc__th-num">Costo</th>
                  <th className="inv-report-doc__th-num">Valor</th>
                  <th className="inv-report-doc__th-num">Utilidad</th>
                  <th className="inv-report-doc__th-num">Cobrado hoy</th>
                  <th className="inv-report-doc__th-num">Pendiente</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((row) => (
                  <tr key={row.id}>
                    <td>{row.origen_label || "Venta"}</td>
                    <td>{row.equipo || "—"}</td>
                    <td className="inv-cell-mono">{row.imei || "—"}</td>
                    <td>{row.proveedor || "—"}</td>
                    <td className="inv-report-doc__num">{reportMoney(row.costo)}</td>
                    <td className="inv-report-doc__num">{reportMoney(row.valor)}</td>
                    <td className="inv-report-doc__num inv-report-doc__num--profit">{reportMoney(row.utilidad)}</td>
                    <td className="inv-report-doc__num inv-report-doc__num--profit">{reportMoney(row.ingreso)}</td>
                    <td className="inv-report-doc__num">{reportMoney(row.pendiente)}</td>
                    <td>{row.responsable || "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4}><strong>Totales equipos</strong></td>
                  <td className="inv-report-doc__num"><strong>{reportMoney(report?.total_costo)}</strong></td>
                  <td className="inv-report-doc__num"><strong>{reportMoney(report?.ventas_netas)}</strong></td>
                  <td className="inv-report-doc__num inv-report-doc__num--profit"><strong>{reportMoney(report?.utilidad_bruta)}</strong></td>
                  <td className="inv-report-doc__num inv-report-doc__num--profit">
                    <strong>{reportMoney(report?.cobrado_ventas_del_dia)}</strong>
                  </td>
                  <td className="inv-report-doc__num">
                    <strong>{reportMoney(report?.pendiente_ventas ?? report?.credito_del_dia)}</strong>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </ReportPreviewSection>

      <ReportPreviewSection title={`Movimientos de caja (${movimientos.length})`}>
        {!movimientos.length ? (
          <ReportPreviewEmpty>Sin movimientos de caja en este período.</ReportPreviewEmpty>
        ) : (
          <div className="inv-report-doc__table-wrap">
            <table className="inv-report-doc__table inv-report-doc__table--ledger">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th className="inv-report-doc__th-num">Costo</th>
                  <th className="inv-report-doc__th-num">Monto</th>
                  <th>Responsable</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((row) => (
                  <tr key={row.id}>
                    <td>{row.origen_label || "—"}</td>
                    <td>{row.type_label || "—"}</td>
                    <td>{row.concept || "—"}</td>
                    <td>{row.method_label || "—"}</td>
                    <td className="inv-report-doc__num">{row.costo != null ? reportMoney(row.costo) : "—"}</td>
                    <td className={`inv-report-doc__num${row.type === "egreso" ? " inv-report-doc__num--out" : " inv-report-doc__num--profit"}`}>
                      {reportMoney(row.amount)}
                    </td>
                    <td>{row.responsable || "—"}</td>
                    <td>{row.notes || "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4}><strong>Totales caja</strong></td>
                  <td className="inv-report-doc__num"><strong>{reportMoney(report?.movimientos_costo_total)}</strong></td>
                  <td className="inv-report-doc__num">
                    <strong className="inv-report-doc__num--profit">{reportMoney(totalIngresos)}</strong>
                    {" / "}
                    <strong className="inv-report-doc__num--out">{reportMoney(totalEgresos)}</strong>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </ReportPreviewSection>

      <div className="inv-report-doc__signatures">
        <div className="inv-report-doc__sign-block">
          <div className="inv-report-doc__sign-area" aria-hidden="true" />
          <div className="inv-report-doc__sign-line">Responsable: ____________________</div>
          <p className="inv-report-doc__sign-hint">Nombre y firma</p>
        </div>
        <div className="inv-report-doc__sign-block">
          <div className="inv-report-doc__sign-area" aria-hidden="true" />
          <div className="inv-report-doc__sign-line">Revisado por: ____________________</div>
          <p className="inv-report-doc__sign-hint">Nombre y firma</p>
        </div>
      </div>

      <ReportPreviewFooter />
    </div>
  );
}

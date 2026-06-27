import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import { useCachedQuery } from "../hooks/useCachedQuery.js";
import api, { isApiConfigured } from "../lib/apiClient";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import { Field, canManageInventory, canViewReports, formatPrice, isServiceTechnician } from "./inventario/shared.jsx";
import "../styles.css";

const FILTER_DEFAULTS = {
  user_id: "",
  supplier_id: "",
  q: "",
  payment_method: "",
  credit_status: "",
};

const PAYMENT_LABELS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  credito: "Crédito",
  mixto: "Mixto",
};

function paymentLabel(method) {
  return PAYMENT_LABELS[method] ?? method ?? "—";
}

function formatSoldAt(soldAt, { includeDate = false } = {}) {
  if (!soldAt) return "—";
  const d = new Date(soldAt);
  if (includeDate) {
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  }
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function defaultExportFrom() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function ReportLoader() {
  return (
    <div className="inv-sheet-empty" style={{ padding: "2rem", textAlign: "center" }}>
      <div className="inv-loader" aria-label="Cargando informe" />
    </div>
  );
}

function SalesReportTable({ sales, showDate = false, emptyMessage = "No hay ventas para este período con los filtros actuales." }) {
  if (!sales?.length) {
    return <p className="inv-dash__muted inv-sheet-empty">{emptyMessage}</p>;
  }

  return (
    <div className="inv-table-wrap">
      <table className="inv-table">
        <thead>
          <tr>
            <th>{showDate ? "Fecha" : "Hora"}</th>
            <th>Equipo</th>
            <th>IMEI</th>
            <th>Precio</th>
            <th>Método</th>
            <th>Cliente</th>
            <th>Vendedor</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td>{formatSoldAt(s.sold_at, { includeDate: showDate })}</td>
              <td>{s.item || "—"}</td>
              <td>{s.imei || "—"}</td>
              <td>{formatPrice(s.sale_price)}</td>
              <td>{paymentLabel(s.payment_method)}</td>
              <td>{s.customer || "—"}</td>
              <td>{s.seller || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentMethodBreakdown({ byMethod, title = "Por método de pago" }) {
  const entries = byMethod && typeof byMethod === "object" ? Object.entries(byMethod) : [];
  if (!entries.length) {
    return <p className="inv-dash__muted inv-sheet-empty">Sin movimientos por método de pago en este período.</p>;
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3 className="inv-panel__subtitle">{title}</h3>
      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Método</th>
              <th>Recaudado</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([method, amount]) => (
              <tr key={method}>
                <td>{paymentLabel(method)}</td>
                <td>{formatPrice(amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportFilters({ filters, onChange, users, suppliers }) {
  return (
    <div className="inv-sheet-toolbar" style={{ flexWrap: "wrap", marginBottom: "1rem" }}>
      <Field label="Vendedor">
        <select className="inv-field__input" value={filters.user_id} onChange={(e) => onChange({ user_id: e.target.value })}>
          <option value="">Todos</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Proveedor">
        <select className="inv-field__input" value={filters.supplier_id} onChange={(e) => onChange({ supplier_id: e.target.value })}>
          <option value="">Todos</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Equipo / referencia">
        <input className="inv-field__input" value={filters.q} onChange={(e) => onChange({ q: e.target.value })} placeholder="iPhone 13…" />
      </Field>
      <Field label="Método pago">
        <select className="inv-field__input" value={filters.payment_method} onChange={(e) => onChange({ payment_method: e.target.value })}>
          <option value="">Todos</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="credito">Crédito</option>
          <option value="mixto">Mixto</option>
        </select>
      </Field>
      <Field label="Estado crédito">
        <select className="inv-field__input" value={filters.credit_status} onChange={(e) => onChange({ credit_status: e.target.value })}>
          <option value="">Todos</option>
          <option value="paid">Pagado</option>
          <option value="pending">Pendiente</option>
        </select>
      </Field>
    </div>
  );
}

export default function InventarioInformes() {
  const { user, authChecked, signOut } = useInventarioPage();
  const [tab, setTab] = useState("daily");
  const [dailyFrom, setDailyFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyTo, setDailyTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthPeriod, setMonthPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [exportFrom, setExportFrom] = useState(defaultExportFrom);
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [toast, setToast] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const year = monthPeriod.slice(0, 4);
  const month = monthPeriod.slice(5, 7);
  const reportsEnabled = authChecked && Boolean(user) && canViewReports(user);

  const filterKey = useMemo(() => ({ ...filters }), [filters]);

  const { data: catalogs } = useCachedQuery(
    ["reportsCatalogs"],
    async () => {
      const data = await api.bootstrapReports({ tab: "daily" });
      return {
        suppliers: data.suppliers || [],
        filter_users: data.filter_users || [],
      };
    },
    { enabled: reportsEnabled },
  );

  const suppliers = catalogs?.suppliers || [];
  const users = catalogs?.filter_users || [];

  const { data: daily, loading: dailyLoading, refreshing: dailyRefreshing } = useCachedQuery(
    ["reports", "daily", { from: dailyFrom, to: dailyTo, ...filterKey }],
    () => api.getDailyReport({ from: dailyFrom, to: dailyTo, ...filterKey }),
    { enabled: reportsEnabled && tab === "daily" },
  );

  const dailyIsRange = dailyFrom !== dailyTo;
  const dailyPeriodLabel = dailyIsRange ? `${dailyFrom}_${dailyTo}` : dailyTo;

  const { data: monthly, loading: monthlyLoading, refreshing: monthlyRefreshing } = useCachedQuery(
    ["reports", "monthly", { year, month, ...filterKey }],
    () => api.getMonthlyReport({ year, month, ...filterKey }),
    { enabled: reportsEnabled && tab === "monthly" },
  );

  const { data: cash, loading: cashLoading, refreshing: cashRefreshing } = useCachedQuery(
    ["reports", "cash", { from, to, ...filterKey }],
    () => api.getCashRegisterReport({ from, to, ...filterKey }),
    { enabled: reportsEnabled && tab === "cash" },
  );

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

  const filterParams = useCallback(() => ({ ...filters }), [filters]);

  const dailyExportParams = () => ({ from: dailyFrom, to: dailyTo, ...filterParams() });

  const exportInventory = async () => {
    try {
      await api.downloadAuthenticated(api.exportInventoryUrl(), `inventario_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const exportSales = async () => {
    try {
      await api.downloadAuthenticated(api.exportSalesUrl(exportFrom, exportTo), `ventas_${exportFrom}_${exportTo}.csv`);
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const openDailyPreview = () => {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(dailyExportParams()).filter(([, v]) => v != null && v !== "")),
    );
    const url = `/admin/inventario/informes/vista-previa?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const exportDailyPdf = async () => {
    setExporting(true);
    try {
      await api.downloadAuthenticated(
        api.exportDailyReportPdfUrl(dailyExportParams()),
        `informe_diario_${dailyPeriodLabel}.pdf`,
      );
      showToast("PDF descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportDailyExcel = async () => {
    setExporting(true);
    try {
      await api.downloadAuthenticated(
        api.exportDailyReportExcelUrl(dailyExportParams()),
        `informe_diario_${dailyPeriodLabel}.xlsx`,
      );
      showToast("Excel descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.importInventory(file);
      showToast(result.message || "Importación completada");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  if (!isApiConfigured || !authChecked || !user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
      </div>
    );
  }

  if (isServiceTechnician(user)) {
    return <Navigate to="/admin/inventario/servicio-tecnico" replace />;
  }

  if (!canViewReports(user)) {
    return <Navigate to="/admin/inventario" replace />;
  }

  return (
    <div className="inv-dash">
      <InventarioTopbar current="informes" title="Informes" subtitle="Diario, mensual y cuadre de caja" user={user} onSignOut={signOut} />
      <main className="inv-main">
        <div className="inv-sheet-actions" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
          {["daily", "monthly", "cash", "export"].map((t) => (
            <button
              key={t}
              type="button"
              className={`inv-btn inv-btn--ghost${tab === t ? " is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "daily" && "Diario"}
              {t === "monthly" && "Mensual"}
              {t === "cash" && "Cuadre de caja"}
              {t === "export" && "Respaldo CSV"}
            </button>
          ))}
        </div>

        {tab === "daily" && (
          <section className="inv-panel">
            <ReportFilters filters={filters} onChange={(p) => setFilters((s) => ({ ...s, ...p }))} users={users} suppliers={suppliers} />
            <div className="inv-sheet-toolbar">
              <Field label="Desde">
                <input type="date" className="inv-field__input" value={dailyFrom} onChange={(e) => setDailyFrom(e.target.value)} />
              </Field>
              <Field label="Hasta">
                <input type="date" className="inv-field__input" value={dailyTo} onChange={(e) => setDailyTo(e.target.value)} />
              </Field>
              <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openDailyPreview} disabled={dailyLoading || !daily}>
                Vista previa
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportDailyPdf} disabled={dailyLoading || exporting || !daily}>
                Exportar PDF
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportDailyExcel} disabled={dailyLoading || exporting || !daily}>
                Exportar Excel
              </button>
            </div>
            {dailyLoading && !daily ? <ReportLoader /> : null}
            {daily && (
              <>
                <p>
                  Ventas: <strong>{daily.totals?.count ?? 0}</strong> · Recaudado: <strong>{formatPrice(daily.totals?.collected ?? 0)}</strong>
                  {daily.totals?.pending > 0 && <> · Pendiente: <strong>{formatPrice(daily.totals.pending)}</strong></>}
                </p>
                <SalesReportTable
                  sales={daily.sales}
                  showDate={dailyIsRange || daily.is_range}
                  emptyMessage="No hay ventas para este período con los filtros actuales."
                />
                <PaymentMethodBreakdown byMethod={daily.totals?.by_method} />
              </>
            )}
          </section>
        )}

        {tab === "monthly" && (
          <section className="inv-panel">
            <ReportFilters filters={filters} onChange={(p) => setFilters((s) => ({ ...s, ...p }))} users={users} suppliers={suppliers} />
            <div className="inv-sheet-toolbar">
              <Field label="Mes">
                <input type="month" className="inv-field__input" value={monthPeriod} onChange={(e) => setMonthPeriod(e.target.value)} />
              </Field>
            </div>
            {monthlyLoading && !monthly ? <ReportLoader /> : null}
            {monthly && (
              <>
                <p>
                  Vendidos: <strong>{monthly.units_sold ?? 0}</strong> · Disponibles: <strong>{monthly.inventory_available ?? 0}</strong> ·
                  Recaudado: <strong>{formatPrice(monthly.totals?.collected ?? 0)}</strong>
                </p>
                {monthly.comparison && (
                  <p className="inv-dash__muted">
                    Mes anterior: {formatPrice(monthly.comparison.previous_month_revenue ?? 0)}
                    {monthly.comparison.change_percent != null && ` · Variación: ${monthly.comparison.change_percent}%`}
                  </p>
                )}
                <SalesReportTable sales={monthly.sales} showDate emptyMessage="No hubo ventas en este mes con los filtros actuales." />
                <PaymentMethodBreakdown byMethod={monthly.totals?.by_method} />
              </>
            )}
          </section>
        )}

        {tab === "cash" && (
          <section className="inv-panel">
            <ReportFilters filters={filters} onChange={(p) => setFilters((s) => ({ ...s, ...p }))} users={users} suppliers={suppliers} />
            <div className="inv-sheet-toolbar">
              <Field label="Desde">
                <input type="date" className="inv-field__input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Hasta">
                <input type="date" className="inv-field__input" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
            {cashLoading && !cash ? <ReportLoader /> : null}
            {cash && (
              <>
                <div className="inv-stats inv-stats--5">
                  <article className="inv-stat inv-stat--blue">
                    <span className="inv-stat__label">Ventas</span>
                    <strong className="inv-stat__value">{cash.sales_count}</strong>
                  </article>
                  <article className="inv-stat inv-stat--green">
                    <span className="inv-stat__label">Recaudado</span>
                    <strong className="inv-stat__value">{formatPrice(cash.total_collected)}</strong>
                  </article>
                  <article className="inv-stat inv-stat--purple">
                    <span className="inv-stat__label">Esperado</span>
                    <strong className="inv-stat__value">{formatPrice(cash.total_expected)}</strong>
                  </article>
                  <article className="inv-stat inv-stat--amber">
                    <span className="inv-stat__label">Créditos pend.</span>
                    <strong className="inv-stat__value">{formatPrice(cash.pending_credits)}</strong>
                  </article>
                  <article className="inv-stat inv-stat--slate">
                    <span className="inv-stat__label">Diferencia</span>
                    <strong className="inv-stat__value">{formatPrice(cash.difference)}</strong>
                  </article>
                </div>
                <PaymentMethodBreakdown byMethod={cash.by_payment_method} title="Recaudado por método de pago" />
              </>
            )}
          </section>
        )}

        {tab === "export" && (
          <section className="inv-panel">
            <h2 className="inv-panel__title">Respaldo CSV</h2>
            <p className="inv-dash__muted">
              Descarga respaldos en CSV compatible con Excel. Para ventas, elige el rango de fechas antes de exportar.
            </p>
            <div className="inv-sheet-toolbar" style={{ marginTop: "1rem", flexWrap: "wrap" }}>
              <Field label="Ventas desde">
                <input type="date" className="inv-field__input" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
              </Field>
              <Field label="Ventas hasta">
                <input type="date" className="inv-field__input" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
              </Field>
            </div>
            <p className="inv-dash__muted" style={{ marginTop: "0.5rem" }}>
              Columnas inventario: Código barras, IMEI, Equipo, Color, Proveedor, Precio compra, Precio venta, Batería, Estado, Fecha ingreso, Notas.
            </p>
            <div className="inv-sheet-actions" style={{ marginTop: "1rem", flexWrap: "wrap" }}>
              {canManageInventory(user) && (
                <button type="button" className="inv-btn inv-btn--outline" onClick={exportInventory}>
                  Exportar inventario (CSV)
                </button>
              )}
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportSales}>
                Exportar ventas (CSV)
              </button>
              {canManageInventory(user) && (
                <label className="inv-btn inv-btn--primary inv-btn--inline" style={{ cursor: "pointer" }}>
                  {importing ? "Importando…" : "Importar inventario (CSV)"}
                  <input type="file" accept=".csv,.txt" hidden onChange={onImport} disabled={importing} />
                </label>
              )}
            </div>
          </section>
        )}
      </main>
      {toast && <div className={`inv-toast inv-toast--${toast.type}`}>{toast.text}</div>}
    </div>
  );
}

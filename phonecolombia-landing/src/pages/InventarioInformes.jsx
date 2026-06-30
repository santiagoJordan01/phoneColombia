import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import MobileCollapsible from "../components/inventario/MobileCollapsible.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import { useCachedQuery } from "../hooks/useCachedQuery.js";
import api, { isApiConfigured } from "../lib/apiClient";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import { supplierSelectOptions, userSelectOptions } from "../lib/inventarioSelectOptions.js";
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

function formatMargin(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
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

function monthDateBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  const from = `${year}-${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function buildExportQuery(params) {
  return new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
  );
}

function ReportLoader() {
  return (
    <div className="inv-sheet-empty" style={{ padding: "2rem", textAlign: "center" }}>
      <div className="inv-loader" aria-label="Cargando informe" />
    </div>
  );
}

function ReportTotalsSummary({ totals, methodology }) {
  if (!totals) return null;

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div className="inv-stats" style={{ marginBottom: methodology ? "0.75rem" : 0 }}>
        <article className="inv-stat inv-stat--blue">
          <span className="inv-stat__label">Ventas</span>
          <strong className="inv-stat__value">{totals.count ?? 0}</strong>
        </article>
        <article className="inv-stat inv-stat--purple">
          <span className="inv-stat__label">Ingresos</span>
          <strong className="inv-stat__value">{formatPrice(totals.revenue ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--slate">
          <span className="inv-stat__label">Costo total</span>
          <strong className="inv-stat__value">{formatPrice(totals.cost ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--green">
          <span className="inv-stat__label">Utilidad bruta</span>
          <strong className="inv-stat__value">{formatPrice(totals.profit ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--amber">
          <span className="inv-stat__label">Margen</span>
          <strong className="inv-stat__value">{formatMargin(totals.margin_percent)}</strong>
        </article>
        <article className="inv-stat inv-stat--green">
          <span className="inv-stat__label">Recaudado</span>
          <strong className="inv-stat__value">{formatPrice(totals.collected ?? 0)}</strong>
        </article>
        {(totals.pending ?? 0) > 0 && (
          <article className="inv-stat inv-stat--amber">
            <span className="inv-stat__label">Pendiente</span>
            <strong className="inv-stat__value">{formatPrice(totals.pending)}</strong>
          </article>
        )}
      </div>
      {methodology && (
        <p className="inv-dash__muted" style={{ margin: 0, fontSize: "0.82rem" }}>{methodology}</p>
      )}
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
            <th>Precio venta</th>
            <th>Costo</th>
            <th>Utilidad</th>
            <th>Margen</th>
            <th>Pagado</th>
            <th>Pendiente</th>
            <th>Método</th>
            <th>Cliente</th>
            <th>Vendedor</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id} className="inv-sheet-row">
              <td data-label={showDate ? "Fecha" : "Hora"}>{formatSoldAt(s.sold_at, { includeDate: showDate })}</td>
              <td data-label="Equipo">{s.item || "—"}</td>
              <td data-label="IMEI">{s.imei || s.barcode || "—"}</td>
              <td data-label="Precio venta">{formatPrice(s.sale_price_num ?? s.sale_price)}</td>
              <td data-label="Costo">{formatPrice(s.purchase_price_num ?? s.purchase_price ?? 0)}</td>
              <td data-label="Utilidad" className="inv-price">{formatPrice(s.net_profit ?? 0)}</td>
              <td data-label="Margen">{formatMargin(s.margin_percent)}</td>
              <td data-label="Pagado">{formatPrice(s.amount_paid ?? 0)}</td>
              <td data-label="Pendiente">{formatPrice(s.amount_due ?? 0)}</td>
              <td data-label="Método">{paymentLabel(s.payment_method)}{s.credit_payment_method ? ` · ${s.credit_payment_method}` : ""}</td>
              <td data-label="Cliente">{s.customer || "—"}</td>
              <td data-label="Vendedor">{s.seller || "—"}</td>
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
              <tr key={method} className="inv-sheet-row">
                <td data-label="Método">{paymentLabel(method)}</td>
                <td data-label="Recaudado">{formatPrice(amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportFilters({ filters, onChange, users, suppliers, dateRange, monthRange }) {
  const userOptions = useMemo(() => userSelectOptions(users), [users]);
  const supplierOptions = useMemo(() => supplierSelectOptions(suppliers), [suppliers]);

  return (
    <MobileCollapsible summary="Filtros del informe" className="inv-mobile-fold--inline">
      <div className="inv-sheet-toolbar">
        <div className="inv-sheet-toolbar__main">
        {dateRange && (
          <>
            <Field label="Desde">
              <input
                type="date"
                className="inv-field__input"
                value={dateRange.from}
                onChange={(e) => dateRange.onFromChange(e.target.value)}
              />
            </Field>
            <Field label="Hasta">
              <input
                type="date"
                className="inv-field__input"
                value={dateRange.to}
                onChange={(e) => dateRange.onToChange(e.target.value)}
              />
            </Field>
          </>
        )}
        {monthRange && (
          <Field label="Mes">
            <input
              type="month"
              className="inv-field__input"
              value={monthRange.value}
              onChange={(e) => monthRange.onChange(e.target.value)}
            />
          </Field>
        )}
        <Field label="Vendedor">
          <SearchSelect
            value={filters.user_id}
            onChange={(id) => onChange({ user_id: id })}
            options={userOptions}
            placeholder="Todos los vendedores"
            searchPlaceholder="Buscar vendedor…"
            clearLabel="Todos"
          />
        </Field>
        <Field label="Proveedor">
          <SearchSelect
            value={filters.supplier_id}
            onChange={(id) => onChange({ supplier_id: id })}
            options={supplierOptions}
            placeholder="Todos los proveedores"
            searchPlaceholder="Buscar proveedor…"
            clearLabel="Todos"
          />
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
    </div>
    </MobileCollapsible>
  );
}

function ReportFilterActions({ children }) {
  if (!children) return null;
  return (
    <div className="inv-sheet-toolbar">
      <div className="inv-sheet-actions">{children}</div>
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

  const { data: bySeller, loading: bySellerLoading } = useCachedQuery(
    ["reports", "bySeller", { from, to, ...filterKey }],
    () => api.getBySellerReport({ from, to, ...filterKey }),
    { enabled: reportsEnabled && tab === "sellers" },
  );

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

  const filterParams = useCallback(() => ({ ...filters }), [filters]);

  const dailyExportParams = () => ({ from: dailyFrom, to: dailyTo, ...filterParams() });
  const monthlyExportParams = () => ({ ...monthDateBounds(year, month), ...filterParams() });
  const sellersExportParams = () => ({ from, to, ...filterParams() });

  const openReportPreview = (params, type = "daily") => {
    const query = buildExportQuery({ ...params, ...(type === "by_seller" ? { type: "by_seller" } : {}) });
    const url = `/admin/inventario/informes/vista-previa?${query.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const exportReportPdf = async (params, filenamePrefix) => {
    setExporting(true);
    try {
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportDailyReportPdfUrl(params),
        `${filenamePrefix}_${label}.pdf`,
      );
      showToast("PDF descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportReportExcel = async (params, filenamePrefix) => {
    setExporting(true);
    try {
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportDailyReportExcelUrl(params),
        `${filenamePrefix}_${label}.xlsx`,
      );
      showToast("Excel descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const openDailyPreview = () => openReportPreview(dailyExportParams());
  const exportDailyPdf = () => exportReportPdf(dailyExportParams(), "informe_diario");
  const exportDailyExcel = () => exportReportExcel(dailyExportParams(), "informe_diario");

  const openMonthlyPreview = () => openReportPreview(monthlyExportParams());
  const exportMonthlyPdf = () => exportReportPdf(monthlyExportParams(), "informe_mensual");
  const exportMonthlyExcel = () => exportReportExcel(monthlyExportParams(), "informe_mensual");

  const openSellersPreview = () => openReportPreview(sellersExportParams(), "by_seller");

  const exportSellersPdf = async () => {
    setExporting(true);
    try {
      const params = sellersExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportBySellerReportPdfUrl(params),
        `informe_por_vendedor_${label}.pdf`,
      );
      showToast("PDF descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportSellersExcel = async () => {
    setExporting(true);
    try {
      const params = sellersExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportBySellerReportExcelUrl(params),
        `informe_por_vendedor_${label}.xlsx`,
      );
      showToast("Excel descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

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
        <div className="inv-sheet-actions inv-report-tabs">
          {["daily", "monthly", "sellers", "cash", "export"].map((t) => (
            <button
              key={t}
              type="button"
              className={`inv-btn inv-btn--ghost${tab === t ? " is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "daily" && "Diario"}
              {t === "monthly" && "Mensual"}
              {t === "sellers" && "Por vendedor"}
              {t === "cash" && "Cuadre de caja"}
              {t === "export" && "Respaldo CSV"}
            </button>
          ))}
        </div>

        {tab === "daily" && (
          <section className="inv-panel">
            <ReportFilters
              filters={filters}
              onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
              users={users}
              suppliers={suppliers}
              dateRange={{ from: dailyFrom, to: dailyTo, onFromChange: setDailyFrom, onToChange: setDailyTo }}
            />
            <ReportFilterActions>
              <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openDailyPreview} disabled={dailyLoading || !daily}>
                Vista previa
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportDailyPdf} disabled={dailyLoading || exporting || !daily}>
                Exportar PDF
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportDailyExcel} disabled={dailyLoading || exporting || !daily}>
                Exportar Excel
              </button>
            </ReportFilterActions>
            {dailyLoading && !daily ? <ReportLoader /> : null}
            {daily && (
              <div className="inv-panel__body">
                <ReportTotalsSummary totals={daily.totals} methodology={daily.methodology} />
                <SalesReportTable
                  sales={daily.sales}
                  showDate={dailyIsRange || daily.is_range}
                  emptyMessage="No hay ventas para este período con los filtros actuales."
                />
                <PaymentMethodBreakdown byMethod={daily.totals?.by_method} />
              </div>
            )}
          </section>
        )}

        {tab === "monthly" && (
          <section className="inv-panel">
            <ReportFilters
              filters={filters}
              onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
              users={users}
              suppliers={suppliers}
              monthRange={{ value: monthPeriod, onChange: setMonthPeriod }}
            />
            <ReportFilterActions>
              <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openMonthlyPreview} disabled={monthlyLoading || !monthly}>
                Vista previa
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportMonthlyPdf} disabled={monthlyLoading || exporting || !monthly}>
                Exportar PDF
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportMonthlyExcel} disabled={monthlyLoading || exporting || !monthly}>
                Exportar Excel
              </button>
            </ReportFilterActions>
            {monthlyLoading && !monthly ? <ReportLoader /> : null}
            {monthly && (
              <div className="inv-panel__body">
                <ReportTotalsSummary totals={monthly.totals} methodology={monthly.methodology} />
                {monthly.comparison && (
                  <p className="inv-dash__muted">
                    Ingresos mes anterior: {formatPrice(monthly.comparison.previous_month_revenue ?? 0)}
                    {monthly.comparison.change_percent != null && ` · Variación ingresos: ${monthly.comparison.change_percent}%`}
                    {monthly.comparison.current_month_profit != null && (
                      <> · Utilidad este mes: <strong>{formatPrice(monthly.comparison.current_month_profit)}</strong></>
                    )}
                  </p>
                )}
                <p>
                  Vendidos: <strong>{monthly.units_sold ?? 0}</strong> · Disponibles en inventario: <strong>{monthly.inventory_available ?? 0}</strong>
                </p>
                <SalesReportTable sales={monthly.sales} showDate emptyMessage="No hubo ventas en este mes con los filtros actuales." />
                <PaymentMethodBreakdown byMethod={monthly.totals?.by_method} />
              </div>
            )}
          </section>
        )}

        {tab === "sellers" && (
          <section className="inv-panel">
            <ReportFilters
              filters={filters}
              onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
              users={users}
              suppliers={suppliers}
              dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}
            />
            <ReportFilterActions>
              <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openSellersPreview} disabled={bySellerLoading || !bySeller}>
                Vista previa
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportSellersPdf} disabled={bySellerLoading || exporting || !bySeller}>
                Exportar PDF
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportSellersExcel} disabled={bySellerLoading || exporting || !bySeller}>
                Exportar Excel
              </button>
            </ReportFilterActions>
            {bySellerLoading && !bySeller ? <ReportLoader /> : null}
            {bySeller && (
              <div className="inv-panel__body">
                <ReportTotalsSummary totals={bySeller.totals} methodology={bySeller.methodology} />
                {(bySeller.sellers || []).map((group) => (
                  <div key={group.seller_id || group.seller} style={{ marginTop: "1.5rem" }}>
                    <h3 className="inv-panel__subtitle">
                      {group.seller} — {group.count} ventas · Ingresos {formatPrice(group.revenue)} · Utilidad {formatPrice(group.profit)}
                      {group.margin_percent != null && ` · Margen ${formatMargin(group.margin_percent)}`}
                      {group.pending > 0 && ` · Pendiente ${formatPrice(group.pending)}`}
                    </h3>
                    <SalesReportTable sales={group.sales} showDate emptyMessage="Sin ventas." />
                  </div>
                ))}
                {!bySeller.sellers?.length && (
                  <p className="inv-dash__muted inv-sheet-empty">No hay ventas por vendedor en este período.</p>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "cash" && (
          <section className="inv-panel">
            <ReportFilters
              filters={filters}
              onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
              users={users}
              suppliers={suppliers}
              dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}
            />
            {cashLoading && !cash ? <ReportLoader /> : null}
            {cash && (
              <div className="inv-panel__body">
                <p className="inv-dash__muted" style={{ marginTop: 0 }}>
                  Cobros según fecha de pago. Las ventas del período se concilian aparte (ingresos vs pagado vs pendiente).
                </p>
                <MobileCollapsible summary="Resumen del cuadre de caja">
                <div className="inv-stats inv-stats--5">
                  <article className="inv-stat inv-stat--blue">
                    <span className="inv-stat__label">Ventas del período</span>
                    <strong className="inv-stat__value">{cash.sales_count}</strong>
                  </article>
                  <article className="inv-stat inv-stat--purple">
                    <span className="inv-stat__label">Ingresos (ventas)</span>
                    <strong className="inv-stat__value">{formatPrice(cash.total_expected)}</strong>
                  </article>
                  <article className="inv-stat inv-stat--green">
                    <span className="inv-stat__label">Cobrado en período</span>
                    <strong className="inv-stat__value">{formatPrice(cash.cash_collected_in_period ?? cash.total_collected)}</strong>
                  </article>
                  <article className="inv-stat inv-stat--amber">
                    <span className="inv-stat__label">Pendiente (ventas)</span>
                    <strong className="inv-stat__value">{formatPrice(cash.pending_credits)}</strong>
                  </article>
                  <article className="inv-stat inv-stat--slate">
                    <span className="inv-stat__label">Conciliación ventas</span>
                    <strong className="inv-stat__value">{formatPrice(cash.difference)}</strong>
                  </article>
                </div>
                </MobileCollapsible>
                <PaymentMethodBreakdown byMethod={cash.by_payment_method} title="Cobros del período por método" />
              </div>
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

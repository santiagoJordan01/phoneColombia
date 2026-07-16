import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import MobileCollapsible from "../components/inventario/MobileCollapsible.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import { useCachedQuery } from "../hooks/useCachedQuery.js";
import api, { isApiConfigured } from "../lib/apiClient";
import RemissionActionMenu from "../components/inventario/RemissionActionMenu.jsx";
import {
  PaymentMethodBadge,
  SalePaidCell,
  SalePendingCell,
} from "../components/inventario/TableValueDisplay.jsx";
import { ReportExcelButton, ReportPdfButton, ReportPreviewButton } from "../components/inventario/ReportExportButtons.jsx";
import InvIcon from "../components/inventario/InvIcon.jsx";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import { supplierSelectOptions, userSelectOptions, brandSelectOptions, catalogModelSelectOptions, IPHONE_STORAGE_OPTIONS } from "../lib/inventarioSelectOptions.js";
import { Field, canManageInventory, canViewReports, formatPrice, isAccountant, isServiceTechnician } from "./inventario/shared.jsx";
import { SALE_PAYMENT_METHODS, paymentLabel } from "../lib/paymentMethods.js";
import { localDateInputValue, localMonthInputValue, startOfLocalMonth } from "../lib/localDate.js";
import "../styles.css";

const REPORT_TABS = [
  { id: "daily", label: "Diario", icon: "calendar" },
  { id: "monthly", label: "Mensual", icon: "calendar" },
  { id: "sellers", label: "Por vendedor", icon: "users" },
  { id: "remissions", label: "Por remisión", icon: "file-text" },
  { id: "settlement", label: "Cuadre de caja", icon: "cash-register" },
  { id: "cash", label: "Libro de caja", icon: "wallet" },
  { id: "receivables", label: "Cartera", icon: "wallet" },
  { id: "intake", label: "Ingresos", icon: "package" },
  { id: "service", label: "Servicio técnico", icon: "servicio" },
  { id: "export", label: "Respaldo CSV", icon: "download" },
];

const FILTER_DEFAULTS = {
  user_id: "",
  supplier_id: "",
  q: "",
  payment_method: "",
  credit_status: "",
  service_status: "",
  workshop: "",
  brand: "",
  model: "",
  storage: "",
  color: "",
  battery: "",
  battery_status: "",
};

const BATTERY_FILTER_OPTIONS = [
  { value: "status:ok", label: "≥ 85%", searchText: "ok alta 85" },
  { value: "status:baja", label: "< 85%", searchText: "baja baja 85" },
  { value: "status:sin_dato", label: "Sin dato", searchText: "sin dato" },
  ...Array.from({ length: 101 }, (_, i) => {
    const pct = 100 - i;
    return {
      value: String(pct),
      label: `${pct}%`,
      searchText: String(pct),
    };
  }),
];

function batteryFilterValue(filters) {
  if (filters.battery !== "" && filters.battery != null) return String(filters.battery);
  if (filters.battery_status) return `status:${filters.battery_status}`;
  return "";
}

function batteryFilterChange(value, onChange) {
  if (!value) {
    onChange({ battery: "", battery_status: "" });
    return;
  }
  if (String(value).startsWith("status:")) {
    onChange({ battery: "", battery_status: String(value).slice(7) });
    return;
  }
  onChange({ battery: String(value), battery_status: "" });
}

const COLLECTION_TYPE_LABELS = {
  venta: "Cobro venta",
  apartado: "Abono apartado",
  abono: "Abono crédito",
  retoma: "Pago retoma",
  otro: "Cobro",
};

function ledgerTypeBadgeClass(type) {
  if (type === "apartado") return "separado";
  if (type === "abono") return "amber";
  if (type === "retoma") return "retomado";
  return "disponible";
}

function collectionTypeLabel(type) {
  return COLLECTION_TYPE_LABELS[type] ?? type ?? "—";
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
  return startOfLocalMonth();
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

  const content = (
    <>
      <div className="inv-stats inv-report-stats" style={{ marginBottom: methodology ? "0.75rem" : 0 }}>
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
        {(totals.collected_in_period ?? null) != null && (
          <article className="inv-stat inv-stat--green">
            <span className="inv-stat__label">Cobros del período</span>
            <strong className="inv-stat__value">{formatPrice(totals.collected_in_period)}</strong>
          </article>
        )}
        <article className="inv-stat inv-stat--green">
          <span className="inv-stat__label">Pagado (ventas)</span>
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
        <p className="inv-dash__muted inv-report-methodology">{methodology}</p>
      )}
    </>
  );

  return (
    <div className="inv-report-summary" style={{ marginBottom: "1rem" }}>
      <MobileCollapsible summary="Resumen del período">
        {content}
      </MobileCollapsible>
    </div>
  );
}

function SalesReportTable({ sales, showDate = false, emptyMessage = "No hay ventas para este período con los filtros actuales." }) {
  if (!sales?.length) {
    return <p className="inv-dash__muted inv-sheet-empty">{emptyMessage}</p>;
  }

  return (
    <div className="inv-table-wrap inv-table-wrap--sheet">
      <table className="inv-table inv-table--sheet inv-table--report">
        <thead>
          <tr>
            <th>{showDate ? "Fecha" : "Hora"}</th>
            <th>Remisión</th>
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
              <td data-label="Remisión"><span className="inv-cell-mono">{s.remission_number || "—"}</span></td>
              <td data-label="Equipo">{s.item || "—"}</td>
              <td data-label="IMEI">{s.imei || s.barcode || "—"}</td>
              <td data-label="Precio venta"><span className="inv-cell-mono">{formatPrice(s.sale_price_num ?? s.sale_price)}</span></td>
              <td data-label="Costo">{formatPrice(s.purchase_price_num ?? s.purchase_price ?? 0)}</td>
              <td data-label="Utilidad" className="inv-price">{formatPrice(s.net_profit ?? 0)}</td>
              <td data-label="Margen">{formatMargin(s.margin_percent)}</td>
              <td data-label="Pagado"><SalePaidCell amountPaid={s.amount_paid} salePrice={s.sale_price_num ?? s.sale_price} /></td>
              <td data-label="Pendiente"><SalePendingCell amountDue={s.amount_due} /></td>
              <td data-label="Método">
                <PaymentMethodBadge
                  method={s.payment_method}
                  suffix={s.credit_payment_method ? ` · ${s.credit_payment_method}` : null}
                />
              </td>
              <td data-label="Cliente">{s.customer || "—"}</td>
              <td data-label="Vendedor">{s.seller || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentMethodBreakdown({ byMethod, title = "Por método de pago", amountLabel = "Recaudado" }) {
  const entries = byMethod && typeof byMethod === "object" ? Object.entries(byMethod) : [];
  if (!entries.length) {
    return <p className="inv-dash__muted inv-sheet-empty">Sin movimientos por método de pago en este período.</p>;
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3 className="inv-panel__subtitle">{title}</h3>
      <div className="inv-table-wrap inv-table-wrap--sheet">
        <table className="inv-table inv-table--sheet inv-table--report">
          <thead>
            <tr>
              <th>Método</th>
              <th>{amountLabel}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([method, amount]) => (
              <tr key={method} className="inv-sheet-row">
                <td data-label="Método"><PaymentMethodBadge method={method} /></td>
                <td data-label={amountLabel}>{formatPrice(amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CollectionTypeBreakdown({ byType }) {
  const entries = byType && typeof byType === "object" ? Object.entries(byType) : [];
  if (!entries.length) return null;

  return (
    <div className="inv-stats" style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
      {entries.map(([type, amount]) => (
        <article key={type} className="inv-stat inv-stat--slate">
          <span className="inv-stat__label">{collectionTypeLabel(type)}</span>
          <strong className="inv-stat__value">{formatPrice(amount)}</strong>
        </article>
      ))}
    </div>
  );
}

function CashLedgerTable({ ledger, showDate = false }) {
  if (!ledger?.length) {
    return <p className="inv-dash__muted inv-sheet-empty">No hay movimientos de caja en este período.</p>;
  }

  return (
    <div className="inv-table-wrap inv-table-wrap--sheet" style={{ marginTop: "1.5rem" }}>
      <h3 className="inv-panel__subtitle">Libro de cobros y retomas</h3>
      <table className="inv-table inv-table--sheet inv-table--report">
        <thead>
          <tr>
            <th>{showDate ? "Fecha" : "Hora"}</th>
            <th>Remisión</th>
            <th>Tipo</th>
            <th>Equipo</th>
            <th>Cliente</th>
            <th>Método</th>
            <th>Monto</th>
            <th>Vendedor</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          {ledger.map((line) => (
            <tr key={line.id} className="inv-sheet-row">
              <td data-label={showDate ? "Fecha" : "Hora"}>
                {formatSoldAt(line.paid_at, { includeDate: showDate })}
              </td>
              <td data-label="Remisión"><span className="inv-cell-mono">{line.remission_number || "—"}</span></td>
              <td data-label="Tipo">
                <span className={`inv-badge inv-badge--${ledgerTypeBadgeClass(line.type)}`}>
                  {line.type_label || collectionTypeLabel(line.type)}
                </span>
              </td>
              <td data-label="Equipo">{line.item || "—"}</td>
              <td data-label="Cliente">{line.customer || "—"}</td>
              <td data-label="Método"><PaymentMethodBadge method={line.method} /></td>
              <td data-label="Monto" className={line.amount < 0 ? "inv-amount--out" : "inv-amount--in"}>
                {formatPrice(line.amount)}
              </td>
              <td data-label="Vendedor">{line.seller || "—"}</td>
              <td data-label="Notas">{line.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceivablesTable({ items, emptyMessage = "No hay saldos pendientes por cobrar." }) {
  if (!items?.length) {
    return <p className="inv-dash__muted inv-sheet-empty">{emptyMessage}</p>;
  }

  return (
    <div className="inv-table-wrap inv-table-wrap--sheet">
      <table className="inv-table inv-table--sheet inv-table--report">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Remisión</th>
            <th>Equipo</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Pagado</th>
            <th>Pendiente</th>
            <th>Vence</th>
            <th>Vendedor</th>
            <th>Financiera</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="inv-sheet-row">
              <td data-label="Tipo">
                <span className={`inv-badge inv-badge--${row.type === "apartado" ? "separado" : "amber"}`}>
                  {row.type_label || row.type}
                </span>
                {row.is_overdue && (
                  <span className="inv-badge inv-badge--vendido" style={{ marginLeft: "0.35rem" }}>
                    Vencido
                  </span>
                )}
              </td>
              <td data-label="Remisión"><span className="inv-cell-mono">{row.remission_number || "—"}</span></td>
              <td data-label="Equipo">{row.item || "—"}</td>
              <td data-label="Cliente">
                {row.customer || "—"}
                {row.customer_phone ? ` · ${row.customer_phone}` : ""}
              </td>
              <td data-label="Total">{formatPrice(row.sale_price)}</td>
              <td data-label="Pagado"><SalePaidCell amountPaid={row.amount_paid} salePrice={row.sale_price} /></td>
              <td data-label="Pendiente"><SalePendingCell amountDue={row.amount_due} /></td>
              <td data-label="Vence">
                {row.due_at
                  ? new Date(row.due_at).toLocaleDateString("es-CO")
                  : "—"}
                {row.is_overdue && row.days_overdue > 0 ? ` (${row.days_overdue}d)` : ""}
              </td>
              <td data-label="Vendedor">{row.seller || "—"}</td>
              <td data-label="Financiera">{row.credit_payment_method || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceivablesSummary({ totals, methodology }) {
  if (!totals) return null;

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div className="inv-stats" style={{ marginBottom: methodology ? "0.75rem" : 0 }}>
        <article className="inv-stat inv-stat--amber">
          <span className="inv-stat__label">Pendiente total</span>
          <strong className="inv-stat__value">{formatPrice(totals.total_due ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--purple">
          <span className="inv-stat__label">Apartados</span>
          <strong className="inv-stat__value">{totals.apartados_count ?? 0}</strong>
        </article>
        <article className="inv-stat inv-stat--purple">
          <span className="inv-stat__label">Saldo apartados</span>
          <strong className="inv-stat__value">{formatPrice(totals.apartados_due ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--blue">
          <span className="inv-stat__label">Créditos</span>
          <strong className="inv-stat__value">{totals.creditos_count ?? 0}</strong>
        </article>
        <article className="inv-stat inv-stat--slate">
          <span className="inv-stat__label">Saldo créditos</span>
          <strong className="inv-stat__value">{formatPrice(totals.creditos_due ?? 0)}</strong>
        </article>
        {(totals.overdue_count ?? 0) > 0 && (
          <article className="inv-stat inv-stat--amber">
            <span className="inv-stat__label">Vencidos ({totals.overdue_count})</span>
            <strong className="inv-stat__value">{formatPrice(totals.overdue_amount ?? 0)}</strong>
          </article>
        )}
        <article className="inv-stat inv-stat--purple">
          <span className="inv-stat__label">Valor ventas</span>
          <strong className="inv-stat__value">{formatPrice(totals.revenue ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--slate">
          <span className="inv-stat__label">Costo total</span>
          <strong className="inv-stat__value">{formatPrice(totals.total_cost ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--green">
          <span className="inv-stat__label">Utilidad bruta</span>
          <strong className="inv-stat__value">{formatPrice(totals.total_profit ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--amber">
          <span className="inv-stat__label">Margen</span>
          <strong className="inv-stat__value">{formatMargin(totals.margin_percent)}</strong>
        </article>
      </div>
      {methodology && (
        <p className="inv-dash__muted" style={{ margin: 0, fontSize: "0.82rem" }}>{methodology}</p>
      )}
    </div>
  );
}

function RemissionReportSummary({ totals, methodology }) {
  if (!totals) return null;

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div className="inv-stats" style={{ marginBottom: methodology ? "0.75rem" : 0 }}>
        <article className="inv-stat inv-stat--blue">
          <span className="inv-stat__label">Remisiones</span>
          <strong className="inv-stat__value">{totals.count ?? 0}</strong>
        </article>
        <article className="inv-stat inv-stat--purple">
          <span className="inv-stat__label">Ingresos</span>
          <strong className="inv-stat__value">{formatPrice(totals.revenue ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--green">
          <span className="inv-stat__label">Pagado</span>
          <strong className="inv-stat__value">{formatPrice(totals.collected ?? 0)}</strong>
        </article>
        {(totals.pending ?? 0) > 0 && (
          <article className="inv-stat inv-stat--amber">
            <span className="inv-stat__label">Pendiente</span>
            <strong className="inv-stat__value">{formatPrice(totals.pending)}</strong>
          </article>
        )}
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
        <article className="inv-stat inv-stat--slate">
          <span className="inv-stat__label">Entregadas</span>
          <strong className="inv-stat__value">{totals.entregados ?? 0}</strong>
        </article>
        <article className="inv-stat inv-stat--purple">
          <span className="inv-stat__label">Apartados</span>
          <strong className="inv-stat__value">{totals.apartados ?? 0}</strong>
        </article>
      </div>
      {methodology && (
        <p className="inv-dash__muted" style={{ margin: 0, fontSize: "0.82rem" }}>{methodology}</p>
      )}
    </div>
  );
}

function IntakeReportSummary({ totals, methodology }) {
  if (!totals) return null;

  return (
    <div>
      <div className="inv-stats inv-report-stats" style={{ marginBottom: methodology ? "0.75rem" : 0 }}>
        <article className="inv-stat inv-stat--blue">
          <span className="inv-stat__label">Equipos ingresados</span>
          <strong className="inv-stat__value">{totals.count ?? 0}</strong>
        </article>
        <article className="inv-stat inv-stat--slate">
          <span className="inv-stat__label">Costo total compra</span>
          <strong className="inv-stat__value">{formatPrice(totals.purchase_total ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--purple">
          <span className="inv-stat__label">Valor venta referencia</span>
          <strong className="inv-stat__value">{formatPrice(totals.sale_value_total ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--green">
          <span className="inv-stat__label">Proveedores</span>
          <strong className="inv-stat__value">{totals.supplier_count ?? 0}</strong>
        </article>
      </div>
      {methodology && (
        <p className="inv-dash__muted" style={{ margin: 0, fontSize: "0.82rem" }}>{methodology}</p>
      )}
    </div>
  );
}

function IntakeGroupedReport({ groups, showDate = false }) {
  if (!groups?.length) {
    return <p className="inv-dash__muted inv-sheet-empty">No hay equipos ingresados en este período con los filtros actuales.</p>;
  }

  return (
    <div className="inv-remission-groups">
      {groups.map((group) => (
        <section key={group.supplier_key || group.supplier_name} className="inv-panel" style={{ marginTop: "1rem" }}>
          <div className="inv-panel__body" style={{ paddingTop: "1rem" }}>
            <h3 className="inv-panel__subtitle" style={{ margin: "0 0 0.75rem" }}>
              {group.supplier_name || "Sin proveedor"}
              {" · "}
              <span className="inv-dash__muted" style={{ fontWeight: 500 }}>
                {group.count ?? 0} equipo{(group.count ?? 0) === 1 ? "" : "s"}
                {" · "}
                Compra {formatPrice(group.purchase_total ?? 0)}
                {" · "}
                Venta ref. {formatPrice(group.sale_value_total ?? 0)}
              </span>
            </h3>
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>{showDate ? "Fecha ingreso" : "Hora"}</th>
                    <th>Equipo</th>
                    <th>IMEI</th>
                    <th>Color</th>
                    <th>Costo</th>
                    <th>Precio venta</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(group.items || []).map((item) => (
                    <tr key={item.id} className="inv-sheet-row">
                      <td data-label={showDate ? "Fecha ingreso" : "Hora"}>{formatSoldAt(item.acquired_at, { includeDate: showDate })}</td>
                      <td data-label="Equipo">{item.name || "—"}</td>
                      <td data-label="IMEI">{item.imei || item.barcode || "—"}</td>
                      <td data-label="Color">{item.color || "—"}</td>
                      <td data-label="Costo">{formatPrice(item.purchase_price ?? 0)}</td>
                      <td data-label="Precio venta">{formatPrice(item.sale_price ?? 0)}</td>
                      <td data-label="Estado">{item.status_label || item.status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function ServiceTicketsReportSummary({ totals, methodology }) {
  if (!totals) return null;

  return (
    <div>
      <div className="inv-stats inv-report-stats" style={{ marginBottom: methodology ? "0.75rem" : 0 }}>
        <article className="inv-stat inv-stat--blue">
          <span className="inv-stat__label">Tickets</span>
          <strong className="inv-stat__value">{totals.count ?? 0}</strong>
        </article>
        <article className="inv-stat inv-stat--amber">
          <span className="inv-stat__label">Abiertos</span>
          <strong className="inv-stat__value">{totals.open_count ?? 0}</strong>
        </article>
        <article className="inv-stat inv-stat--green">
          <span className="inv-stat__label">Cerrados</span>
          <strong className="inv-stat__value">{totals.closed_count ?? 0}</strong>
        </article>
        <article className="inv-stat inv-stat--slate">
          <span className="inv-stat__label">Costo reparación</span>
          <strong className="inv-stat__value">{formatPrice(totals.repair_cost ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--purple">
          <span className="inv-stat__label">Precio al cliente</span>
          <strong className="inv-stat__value">{formatPrice(totals.customer_price ?? 0)}</strong>
        </article>
        <article className="inv-stat inv-stat--green">
          <span className="inv-stat__label">Margen</span>
          <strong className="inv-stat__value">{formatPrice(totals.margin ?? 0)}</strong>
        </article>
      </div>
      {methodology && (
        <p className="inv-dash__muted" style={{ margin: 0, fontSize: "0.82rem" }}>{methodology}</p>
      )}
    </div>
  );
}

function ServiceTicketsReportTable({ tickets, showDate = false }) {
  if (!tickets?.length) {
    return <p className="inv-dash__muted inv-sheet-empty">No hay tickets en este período con los filtros actuales.</p>;
  }

  return (
    <div className="inv-table-wrap inv-table-wrap--sheet">
      <table className="inv-table inv-table--sheet inv-table--report">
        <thead>
          <tr>
            <th>{showDate ? "Recibido" : "Hora"}</th>
            <th>Equipo</th>
            <th>Referencia</th>
            <th>Tipo</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Técnico</th>
            <th>Taller</th>
            <th>Costo</th>
            <th>Precio</th>
            <th>Margen</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="inv-sheet-row">
              <td data-label={showDate ? "Recibido" : "Hora"}>{formatSoldAt(ticket.received_at, { includeDate: showDate })}</td>
              <td data-label="Equipo">{ticket.display_name || "—"}</td>
              <td data-label="Referencia">{ticket.device_reference || ticket.imei || "—"}</td>
              <td data-label="Tipo">{ticket.ticket_type_label || ticket.ticket_type || "—"}</td>
              <td data-label="Cliente">{ticket.customer_name || "—"}</td>
              <td data-label="Estado">{ticket.status_label || ticket.status || "—"}</td>
              <td data-label="Técnico">{ticket.technician || "—"}</td>
              <td data-label="Taller">{ticket.workshop || "—"}</td>
              <td data-label="Costo">{formatPrice(ticket.repair_cost ?? 0)}</td>
              <td data-label="Precio">{formatPrice(ticket.customer_price ?? 0)}</td>
              <td data-label="Margen">{formatPrice(ticket.margin ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RemissionGroupedReport({ remissions, showDate = false, onNotify }) {
  if (!remissions?.length) {
    return <p className="inv-dash__muted inv-sheet-empty">No hay remisiones en este período con los filtros actuales.</p>;
  }

  return (
    <div className="inv-remission-groups">
      {remissions.map((rem) => (
        <section key={rem.sale_id || rem.remission_number} className="inv-panel" style={{ marginTop: "1rem" }}>
          <div className="inv-panel__body" style={{ paddingTop: "1rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div>
                <h3 className="inv-panel__subtitle" style={{ margin: 0 }}>
                  <span className="inv-cell-mono">{rem.remission_number}</span>
                  {" · "}
                  <span className={`inv-badge inv-badge--${rem.status === "apartado" ? "separado" : rem.status === "entregado" ? "disponible" : rem.status === "devuelto" ? "retomado" : "slate"}`}>
                    {rem.status_label || rem.status}
                  </span>
                </h3>
                <p className="inv-dash__muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                  {formatSoldAt(rem.document_date, { includeDate: true })}
                  {rem.customer ? ` · ${rem.customer}` : ""}
                  {rem.customer_phone ? ` · ${rem.customer_phone}` : ""}
                  {rem.seller ? ` · ${rem.seller}` : ""}
                </p>
              </div>
              {rem.sale_id && rem.remission_number && (
                <RemissionActionMenu
                  saleId={rem.sale_id}
                  remissionNumber={rem.remission_number}
                  onNotify={onNotify}
                />
              )}
            </div>

            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>IMEI</th>
                    <th>Precio venta</th>
                    <th>Costo</th>
                    <th>Utilidad</th>
                    <th>Pagado</th>
                    <th>Pendiente</th>
                    <th>Método</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="inv-sheet-row">
                    <td data-label="Equipo">{rem.item || "—"}</td>
                    <td data-label="IMEI">{rem.imei || rem.barcode || "—"}</td>
                    <td data-label="Precio venta"><span className="inv-cell-mono">{formatPrice(rem.sale_price_num ?? rem.sale_price)}</span></td>
                    <td data-label="Costo">{formatPrice(rem.purchase_price_num ?? 0)}</td>
                    <td data-label="Utilidad">{formatPrice(rem.net_profit ?? 0)}</td>
                    <td data-label="Pagado"><SalePaidCell amountPaid={rem.amount_paid} salePrice={rem.sale_price_num ?? rem.sale_price} /></td>
                    <td data-label="Pendiente"><SalePendingCell amountDue={rem.amount_due} /></td>
                    <td data-label="Método">
                      <PaymentMethodBadge
                        method={rem.payment_method}
                        suffix={rem.credit_payment_method ? ` · ${rem.credit_payment_method}` : null}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {rem.payments?.length > 0 ? (
              <div className="inv-table-wrap" style={{ marginTop: "0.75rem" }}>
                <h4 className="inv-panel__subtitle" style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Pagos de la remisión</h4>
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>{showDate ? "Fecha" : "Hora"}</th>
                      <th>Método</th>
                      <th>Monto</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rem.payments.map((payment) => (
                      <tr key={payment.id} className="inv-sheet-row">
                        <td data-label={showDate ? "Fecha" : "Hora"}>{formatSoldAt(payment.paid_at, { includeDate: showDate })}</td>
                        <td data-label="Método"><PaymentMethodBadge method={payment.method} /></td>
                        <td data-label="Monto">{formatPrice(payment.amount)}</td>
                        <td data-label="Notas">{payment.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="inv-dash__muted" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>Sin pagos registrados.</p>
            )}

            {rem.notes?.trim() && (
              <p className="inv-dash__muted" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
                <strong>Notas:</strong> {rem.notes.trim()}
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function ReportFilters({
  filters,
  onChange,
  users,
  suppliers,
  filterBrands = [],
  filterModels = [],
  filterStorages = [],
  filterColors = [],
  serviceStates = [],
  workshops = [],
  dateRange,
  monthRange,
  searchPlaceholder,
  mode = "sales",
}) {
  const userOptions = useMemo(() => userSelectOptions(users), [users]);
  const supplierOptions = useMemo(() => supplierSelectOptions(suppliers), [suppliers]);
  const brandOptions = useMemo(
    () => brandSelectOptions((filterBrands || []).map((name) => ({ name }))),
    [filterBrands],
  );
  const modelOptions = useMemo(
    () => catalogModelSelectOptions(
      [],
      (filterModels || []).map((row) => ({ brand: row.brand, model: row.model })),
      filters.brand,
    ),
    [filterModels, filters.brand],
  );
  const storageOptions = useMemo(() => {
    const fromCatalog = (filterStorages || []).map((storage) => ({
      value: storage,
      label: storage,
      searchText: storage,
    }));
    const merged = new Map();
    [...IPHONE_STORAGE_OPTIONS, ...fromCatalog].forEach((opt) => {
      merged.set(String(opt.value).toUpperCase(), {
        value: String(opt.value).toUpperCase(),
        label: String(opt.label).toUpperCase(),
        searchText: String(opt.searchText || opt.label).toUpperCase(),
      });
    });
    return [...merged.values()];
  }, [filterStorages]);
  const colorOptions = useMemo(
    () => (filterColors || []).map((color) => ({
      value: color.name,
      label: color.name,
      searchText: color.name,
    })),
    [filterColors],
  );
  const showSalesFilters = mode === "sales";
  const showIntakeFilters = mode === "intake";
  const showServiceFilters = mode === "service";
  const showDeviceFilters = showSalesFilters || showIntakeFilters || showServiceFilters;

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
        {showSalesFilters && (
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
        )}
        {(showSalesFilters || showIntakeFilters) && (
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
        )}
        {showDeviceFilters && (
          <>
            <Field label="Marca">
              <SearchSelect
                value={filters.brand}
                onChange={(brand) => onChange({ brand, model: "" })}
                options={brandOptions}
                placeholder="Todas las marcas"
                searchPlaceholder="Buscar marca…"
                clearLabel="Todas"
              />
            </Field>
            <Field label="Modelo">
              <SearchSelect
                value={filters.model}
                onChange={(model) => onChange({ model })}
                options={modelOptions}
                placeholder={filters.brand ? "Todos los modelos" : "Elige una marca"}
                searchPlaceholder="Buscar modelo…"
                clearLabel="Todos"
                disabled={!filters.brand}
              />
            </Field>
            <Field label="Almacenamiento">
              <SearchSelect
                value={filters.storage}
                onChange={(storage) => onChange({ storage })}
                options={storageOptions}
                placeholder="Todos"
                searchPlaceholder="Buscar almacenamiento…"
                clearLabel="Todos"
              />
            </Field>
            <Field label="Color">
              <SearchSelect
                value={filters.color}
                onChange={(color) => onChange({ color })}
                options={colorOptions}
                placeholder="Todos los colores"
                searchPlaceholder="Buscar color…"
                clearLabel="Todos"
              />
            </Field>
            <Field label="Batería">
              <SearchSelect
                value={batteryFilterValue(filters)}
                onChange={(value) => batteryFilterChange(value, onChange)}
                options={BATTERY_FILTER_OPTIONS}
                placeholder="Todas"
                searchPlaceholder="Buscar % o rango…"
                clearLabel="Todas"
              />
            </Field>
          </>
        )}
        <Field label={showServiceFilters ? "Equipo / cliente" : showIntakeFilters ? "Equipo / proveedor" : "Equipo / remisión"}>
          <input className="inv-field__input" value={filters.q} onChange={(e) => onChange({ q: e.target.value })} placeholder={searchPlaceholder || "Equipo, IMEI o R-2026-000001…"} />
        </Field>
        {showSalesFilters && (
          <>
            <Field label="Método pago">
              <select className="inv-field__input" value={filters.payment_method} onChange={(e) => onChange({ payment_method: e.target.value })}>
                <option value="">Todos</option>
                {SALE_PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Estado crédito">
              <select className="inv-field__input" value={filters.credit_status} onChange={(e) => onChange({ credit_status: e.target.value })}>
                <option value="">Todos</option>
                <option value="paid">Pagado</option>
                <option value="pending">Pendiente</option>
              </select>
            </Field>
          </>
        )}
        {showServiceFilters && (
          <>
            <Field label="Estado ST">
              <select className="inv-field__input" value={filters.service_status} onChange={(e) => onChange({ service_status: e.target.value })}>
                <option value="">Todos</option>
                {serviceStates.map((state) => (
                  <option key={state.slug} value={state.slug}>{state.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Taller">
              <select className="inv-field__input" value={filters.workshop} onChange={(e) => onChange({ workshop: e.target.value })}>
                <option value="">Todos</option>
                {workshops.map((workshop) => (
                  <option key={workshop} value={workshop}>{workshop}</option>
                ))}
              </select>
            </Field>
          </>
        )}
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
  const [dailyFrom, setDailyFrom] = useState(() => localDateInputValue());
  const [dailyTo, setDailyTo] = useState(() => localDateInputValue());
  const [monthPeriod, setMonthPeriod] = useState(() => localMonthInputValue());
  const [from, setFrom] = useState(() => localDateInputValue());
  const [to, setTo] = useState(() => localDateInputValue());
  const [exportFrom, setExportFrom] = useState(defaultExportFrom);
  const [exportTo, setExportTo] = useState(() => localDateInputValue());
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
        service_ticket_states: data.service_ticket_states || [],
        workshops: data.workshops || [],
        filter_brands: data.filter_brands || [],
        filter_models: data.filter_models || [],
        filter_storages: data.filter_storages || [],
        filter_colors: data.filter_colors || [],
      };
    },
    { enabled: reportsEnabled },
  );

  const suppliers = catalogs?.suppliers || [];
  const users = catalogs?.filter_users || [];
  const serviceStates = catalogs?.service_ticket_states || [];
  const workshops = catalogs?.workshops || [];
  const filterBrands = catalogs?.filter_brands || [];
  const filterModels = catalogs?.filter_models || [];
  const filterStorages = catalogs?.filter_storages || [];
  const filterColors = catalogs?.filter_colors || [];
  const deviceFilterProps = {
    filterBrands,
    filterModels,
    filterStorages,
    filterColors,
  };

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

  const { data: settlement, loading: settlementLoading, refreshing: settlementRefreshing } = useCachedQuery(
    ["reports", "settlement", { from, to, ...filterKey }],
    () => api.getDailySettlementReport({ from, to, ...filterKey }),
    { enabled: reportsEnabled && tab === "settlement" },
  );

  const { data: receivables, loading: receivablesLoading } = useCachedQuery(
    ["reports", "receivables", filterKey],
    () => api.getReceivablesReport(filterKey),
    { enabled: reportsEnabled && tab === "receivables" },
  );

  const cashIsRange = from !== to;

  const { data: bySeller, loading: bySellerLoading } = useCachedQuery(
    ["reports", "bySeller", { from, to, ...filterKey }],
    () => api.getBySellerReport({ from, to, ...filterKey }),
    { enabled: reportsEnabled && tab === "sellers" },
  );

  const { data: byRemission, loading: byRemissionLoading } = useCachedQuery(
    ["reports", "byRemission", { from, to, ...filterKey }],
    () => api.getByRemissionReport({ from, to, ...filterKey }),
    { enabled: reportsEnabled && tab === "remissions" },
  );

  const { data: intake, loading: intakeLoading } = useCachedQuery(
    ["reports", "intake", { from, to, ...filterKey }],
    () => api.getInventoryIntakeReport({ from, to, ...filterKey }),
    { enabled: reportsEnabled && tab === "intake" },
  );

  const { data: serviceReport, loading: serviceReportLoading } = useCachedQuery(
    ["reports", "service", { from, to, ...filterKey }],
    () => api.getServiceTicketsReport({ from, to, ...filterKey }),
    { enabled: reportsEnabled && tab === "service" },
  );

  const remissionIsRange = from !== to;
  const intakeIsRange = from !== to;
  const serviceIsRange = from !== to;

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

  const filterParams = useCallback(() => ({ ...filters }), [filters]);

  const dailyExportParams = () => ({ from: dailyFrom, to: dailyTo, ...filterParams() });
  const monthlyExportParams = () => ({ ...monthDateBounds(year, month), ...filterParams() });
  const sellersExportParams = () => ({ from, to, ...filterParams() });
  const remissionExportParams = () => ({ from, to, ...filterParams() });
  const intakeExportParams = () => ({ from, to, ...filterParams() });
  const serviceExportParams = () => ({ from, to, ...filterParams() });
  const cashExportParams = () => ({ from, to, ...filterParams() });
  const settlementExportParams = () => ({ from, to, ...filterParams() });
  const receivablesExportParams = () => ({ ...filterParams() });

  const openReportPreview = (params, type = "daily") => {
    const query = buildExportQuery({
      ...params,
      ...(type && type !== "daily" ? { type } : {}),
    });
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
  const openRemissionPreview = () => openReportPreview(remissionExportParams(), "by_remission");
  const openIntakePreview = () => openReportPreview(intakeExportParams(), "inventory_intake");
  const openServicePreview = () => openReportPreview(serviceExportParams(), "service_tickets");

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

  const exportRemissionsXls = async () => {
    setExporting(true);
    try {
      const params = remissionExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportByRemissionReportXlsUrl(params),
        `Reporte de remisiones de venta ${label}.xls`,
      );
      showToast("Informe de remisiones descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportRemissionsPdf = async () => {
    setExporting(true);
    try {
      const params = remissionExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportByRemissionReportPdfUrl(params),
        `informe_por_remision_${label}.pdf`,
      );
      showToast("PDF descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportIntakePdf = async () => {
    setExporting(true);
    try {
      const params = intakeExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportInventoryIntakeReportPdfUrl(params),
        `ingresos_inventario_${label}.pdf`,
      );
      showToast("PDF descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportIntakeExcel = async () => {
    setExporting(true);
    try {
      const params = intakeExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportInventoryIntakeReportExcelUrl(params),
        `ingresos_inventario_${label}.xlsx`,
      );
      showToast("Excel descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportServicePdf = async () => {
    setExporting(true);
    try {
      const params = serviceExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportServiceTicketsReportPdfUrl(params),
        `servicio_tecnico_${label}.pdf`,
      );
      showToast("PDF descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportServiceExcel = async () => {
    setExporting(true);
    try {
      const params = serviceExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportServiceTicketsReportExcelUrl(params),
        `servicio_tecnico_${label}.xlsx`,
      );
      showToast("Excel descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const openCashPreview = () => openReportPreview(cashExportParams(), "cash_register");
  const openSettlementPreview = () => openReportPreview(settlementExportParams(), "daily_settlement");

  const exportCashPdf = async () => {
    setExporting(true);
    try {
      const params = cashExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportCashRegisterReportPdfUrl(params),
        `libro_caja_${label}.pdf`,
      );
      showToast("PDF descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportCashExcel = async () => {
    setExporting(true);
    try {
      const params = cashExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportCashRegisterReportExcelUrl(params),
        `libro_caja_${label}.xlsx`,
      );
      showToast("Excel descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportSettlementPdf = async () => {
    setExporting(true);
    try {
      const params = settlementExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportDailySettlementReportPdfUrl(params),
        `cuadre_caja_${label}.pdf`,
      );
      showToast("PDF descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportSettlementExcel = async () => {
    setExporting(true);
    try {
      const params = settlementExportParams();
      const label = params.from === params.to ? params.to : `${params.from}_${params.to}`;
      await api.downloadAuthenticated(
        api.exportDailySettlementReportExcelUrl(params),
        `cuadre_caja_${label}.xlsx`,
      );
      showToast("Excel descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const openReceivablesPreview = () => openReportPreview(receivablesExportParams(), "receivables");

  const exportReceivablesPdf = async () => {
    setExporting(true);
    try {
      const label = localDateInputValue();
      await api.downloadAuthenticated(
        api.exportReceivablesReportPdfUrl(receivablesExportParams()),
        `cartera_${label}.pdf`,
      );
      showToast("PDF descargado");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const exportReceivablesExcel = async () => {
    setExporting(true);
    try {
      const label = localDateInputValue();
      await api.downloadAuthenticated(
        api.exportReceivablesReportExcelUrl(receivablesExportParams()),
        `cartera_${label}.xlsx`,
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
      await api.downloadAuthenticated(api.exportInventoryUrl(), `inventario_${localDateInputValue()}.csv`);
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
    return <Navigate to={isAccountant(user) ? "/admin/inventario/dashboard" : "/admin/inventario"} replace />;
  }

  return (
    <div className="inv-dash">
      <InventarioTopbar current="informes" title="Informes" subtitle="Ventas, ingresos, ST, caja y respaldos" user={user} onSignOut={signOut} />
      <main className="inv-main">
        <div className="inv-sheet-actions inv-report-tabs">
          {REPORT_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`inv-btn inv-btn--ghost${tab === item.id ? " is-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <InvIcon name={item.icon} />
              {item.label}
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
              {...deviceFilterProps}
              dateRange={{ from: dailyFrom, to: dailyTo, onFromChange: setDailyFrom, onToChange: setDailyTo }}
            />
            <ReportFilterActions>
              <ReportPreviewButton onClick={openDailyPreview} disabled={dailyLoading || !daily} />
              <ReportPdfButton onClick={exportDailyPdf} disabled={dailyLoading || exporting || !daily} />
              <ReportExcelButton onClick={exportDailyExcel} disabled={dailyLoading || exporting || !daily} />
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
                <PaymentMethodBreakdown
                  byMethod={daily.totals?.by_method}
                  title="Cobros del período por método (fecha de pago)"
                />
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
              {...deviceFilterProps}
              monthRange={{ value: monthPeriod, onChange: setMonthPeriod }}
            />
            <ReportFilterActions>
              <ReportPreviewButton onClick={openMonthlyPreview} disabled={monthlyLoading || !monthly} />
              <ReportPdfButton onClick={exportMonthlyPdf} disabled={monthlyLoading || exporting || !monthly} />
              <ReportExcelButton onClick={exportMonthlyExcel} disabled={monthlyLoading || exporting || !monthly} />
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
                <PaymentMethodBreakdown
                  byMethod={monthly.totals?.by_method}
                  title="Cobros del período por método (fecha de pago)"
                />
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
              {...deviceFilterProps}
              dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}
            />
            <ReportFilterActions>
              <ReportPreviewButton onClick={openSellersPreview} disabled={bySellerLoading || !bySeller} />
              <ReportPdfButton onClick={exportSellersPdf} disabled={bySellerLoading || exporting || !bySeller} />
              <ReportExcelButton onClick={exportSellersExcel} disabled={bySellerLoading || exporting || !bySeller} />
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

        {tab === "remissions" && (
          <section className="inv-panel">
            <ReportFilters
              filters={filters}
              onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
              users={users}
              suppliers={suppliers}
              {...deviceFilterProps}
              dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}
              searchPlaceholder="Remisión, equipo o IMEI…"
            />
            <ReportFilterActions>
              <ReportPreviewButton onClick={openRemissionPreview} disabled={byRemissionLoading || !byRemission} />
              <ReportPdfButton onClick={exportRemissionsPdf} disabled={byRemissionLoading || exporting || !byRemission} />
              <ReportExcelButton
                onClick={exportRemissionsXls}
                disabled={byRemissionLoading || exporting || !byRemission}
              >
                Exportar informe remisiones (.xls)
              </ReportExcelButton>
            </ReportFilterActions>
            {byRemissionLoading && !byRemission ? <ReportLoader /> : null}
            {byRemission && (
              <div className="inv-panel__body">
                <RemissionReportSummary totals={byRemission.totals} methodology={byRemission.methodology} />
                <RemissionGroupedReport
                  remissions={byRemission.remissions}
                  showDate={remissionIsRange || byRemission.is_range}
                  onNotify={showToast}
                />
              </div>
            )}
          </section>
        )}

        {tab === "settlement" && (
          <section className="inv-panel">
            <ReportFilters
              filters={filters}
              onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
              users={users}
              suppliers={suppliers}
              {...deviceFilterProps}
              dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}
            />
            <ReportFilterActions>
              <ReportPreviewButton onClick={openSettlementPreview} disabled={settlementLoading || !settlement} />
              <ReportPdfButton onClick={exportSettlementPdf} disabled={settlementLoading || exporting || !settlement} />
              <ReportExcelButton onClick={exportSettlementExcel} disabled={settlementLoading || exporting || !settlement} />
            </ReportFilterActions>
            {settlementLoading && !settlement ? <ReportLoader /> : null}
            {settlement && (
              <div className="inv-panel__body">
                <p className="inv-dash__muted inv-report-methodology" style={{ marginTop: 0 }}>
                  {settlement.methodology}
                </p>
                <MobileCollapsible summary="Resumen del cuadre de caja">
                  <div className="inv-stats inv-stats--5 inv-report-stats">
                    <article className="inv-stat inv-stat--blue">
                      <span className="inv-stat__label">Fecha</span>
                      <strong className="inv-stat__value" style={{ fontSize: "1rem" }}>{settlement.fecha}</strong>
                    </article>
                    <article className="inv-stat inv-stat--purple">
                      <span className="inv-stat__label">Ventas netas</span>
                      <strong className="inv-stat__value">{formatPrice(settlement.ventas_netas)}</strong>
                    </article>
                    <article className="inv-stat inv-stat--slate">
                      <span className="inv-stat__label">Costo</span>
                      <strong className="inv-stat__value">{formatPrice(settlement.total_costo ?? 0)}</strong>
                    </article>
                    <article className="inv-stat inv-stat--green">
                      <span className="inv-stat__label">Utilidad bruta</span>
                      <strong className="inv-stat__value">{formatPrice(settlement.utilidad_bruta ?? 0)}</strong>
                    </article>
                    <article className="inv-stat inv-stat--green">
                      <span className="inv-stat__label">Ingresos de caja</span>
                      <strong className="inv-stat__value">{formatPrice(settlement.total_ingresos)}</strong>
                    </article>
                    <article className="inv-stat inv-stat--amber">
                      <span className="inv-stat__label">Egresos de caja</span>
                      <strong className="inv-stat__value">{formatPrice(settlement.total_egresos)}</strong>
                    </article>
                    <article className="inv-stat inv-stat--slate">
                      <span className="inv-stat__label">Neto de caja</span>
                      <strong className="inv-stat__value">{formatPrice(settlement.neto_caja ?? (settlement.total_ingresos - settlement.total_egresos))}</strong>
                    </article>
                  </div>
                  <p className="inv-dash__muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
                    Ingresos: cobros {formatPrice(settlement.ingresos_cobros ?? settlement.ingresos_venta)} + manual {formatPrice(settlement.ingresos_manuales)}
                    {" · "}
                    Egresos: retoma {formatPrice(settlement.egresos_retoma)} + manual {formatPrice(settlement.egresos_manuales)}
                    {" · "}
                    Cobrado acum. ventas {formatPrice(settlement.cobrado_acumulado_ventas ?? settlement.cobrado_ventas_del_dia)}
                    {" + "}
                    pendiente {formatPrice(settlement.pendiente_ventas ?? settlement.credito_del_dia)}
                    {" · "}
                    Dif. ventas {formatPrice(settlement.diferencia)}
                  </p>
                </MobileCollapsible>

                <h3 className="inv-panel__subtitle" style={{ marginTop: "1.25rem" }}>Formas de pago</h3>
                <div className="inv-table-wrap">
                  <table className="inv-table inv-table--sheet inv-table--report">
                    <thead>
                      <tr>
                        <th>Método</th>
                        <th>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(settlement.formas_de_pago || []).map((forma) => (
                        <tr key={forma.key || forma.label} className="inv-sheet-row">
                          <td data-label="Método">{forma.label}</td>
                          <td data-label="Monto">{formatPrice(forma.amount)}</td>
                        </tr>
                      ))}
                      <tr className="inv-sheet-row">
                        <td data-label="Método"><strong>Formas de caja (sin crédito)</strong></td>
                        <td data-label="Monto"><strong>{formatPrice(settlement.total_formas_caja ?? 0)}</strong></td>
                      </tr>
                      <tr className="inv-sheet-row">
                        <td data-label="Método"><strong>Neto de caja (ingresos − egresos)</strong></td>
                        <td data-label="Monto"><strong>{formatPrice(settlement.neto_caja)}</strong></td>
                      </tr>
                      <tr className="inv-sheet-row">
                        <td data-label="Método"><strong>Diferencia ventas (precio − cobrado − pendiente)</strong></td>
                        <td data-label="Monto"><strong>{formatPrice(settlement.diferencia)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="inv-panel__subtitle" style={{ marginTop: "1.25rem" }}>
                  Equipos vendidos ({settlement.equipos_count || 0})
                </h3>
                <div className="inv-table-wrap">
                  <table className="inv-table inv-table--sheet inv-table--report">
                    <thead>
                      <tr>
                        <th>Origen</th>
                        <th>Equipo</th>
                        <th>IMEI</th>
                        <th>Proveedor</th>
                        <th>Costo</th>
                        <th>Valor</th>
                        <th>Utilidad</th>
                        <th>Cobrado hoy</th>
                        <th>Pendiente</th>
                        <th>Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(settlement.equipos_vendidos || []).length === 0 ? (
                        <tr>
                          <td colSpan={10} className="inv-empty">Sin equipos en el período.</td>
                        </tr>
                      ) : (
                        (settlement.equipos_vendidos || []).map((row) => (
                          <tr key={row.id} className="inv-sheet-row">
                            <td data-label="Origen">{row.origen_label || "Venta"}</td>
                            <td data-label="Equipo">{row.equipo || "—"}</td>
                            <td data-label="IMEI" className="inv-cell-mono">{row.imei || "—"}</td>
                            <td data-label="Proveedor">{row.proveedor || "—"}</td>
                            <td data-label="Costo">{formatPrice(row.costo ?? 0)}</td>
                            <td data-label="Valor">{formatPrice(row.valor)}</td>
                            <td data-label="Utilidad">{formatPrice(row.utilidad ?? ((row.valor || 0) - (row.costo || 0)))}</td>
                            <td data-label="Cobrado hoy">{formatPrice(row.ingreso)}</td>
                            <td data-label="Pendiente">{formatPrice(row.pendiente ?? 0)}</td>
                            <td data-label="Responsable">{row.responsable || "—"}</td>
                          </tr>
                        ))
                      )}
                      {(settlement.equipos_vendidos || []).length > 0 && (
                        <tr className="inv-sheet-row">
                          <td data-label="" colSpan={4}><strong>Totales equipos</strong></td>
                          <td data-label="Costo"><strong>{formatPrice(settlement.total_costo ?? 0)}</strong></td>
                          <td data-label="Valor"><strong>{formatPrice(settlement.ventas_netas)}</strong></td>
                          <td data-label="Utilidad"><strong>{formatPrice(settlement.utilidad_bruta ?? 0)}</strong></td>
                          <td data-label="Cobrado hoy"><strong>{formatPrice(settlement.cobrado_ventas_del_dia)}</strong></td>
                          <td data-label="Pendiente"><strong>{formatPrice(settlement.pendiente_ventas ?? settlement.credito_del_dia)}</strong></td>
                          <td data-label="" />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <h3 className="inv-panel__subtitle" style={{ marginTop: "1.25rem" }}>
                  Movimientos de caja ({settlement.movimientos_count || 0})
                </h3>
                <div className="inv-table-wrap">
                  <table className="inv-table inv-table--sheet inv-table--report">
                    <thead>
                      <tr>
                        <th>Origen</th>
                        <th>Tipo</th>
                        <th>Concepto</th>
                        <th>Método</th>
                        <th>Costo</th>
                        <th>Monto</th>
                        <th>Responsable</th>
                        <th>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(settlement.movimientos_caja || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="inv-empty">Sin movimientos en el período.</td>
                        </tr>
                      ) : (
                        (settlement.movimientos_caja || []).map((row) => (
                          <tr key={row.id} className="inv-sheet-row">
                            <td data-label="Origen">
                              <span className={`inv-badge inv-badge--${
                                row.origen === "manual" ? "amber"
                                  : row.origen === "retoma" ? "retomado"
                                    : row.origen === "abono" || row.origen === "apartado" ? "separado"
                                      : "disponible"
                              }`}>
                                {row.origen_label || row.origen}
                              </span>
                            </td>
                            <td data-label="Tipo">{row.type_label || "—"}</td>
                            <td data-label="Concepto">{row.concept || "—"}</td>
                            <td data-label="Método">{row.method_label || "—"}</td>
                            <td data-label="Costo">{row.costo != null ? formatPrice(row.costo) : "—"}</td>
                            <td data-label="Monto" className={row.type === "egreso" ? "inv-amount--out" : "inv-amount--in"}>
                              {formatPrice(row.amount)}
                            </td>
                            <td data-label="Responsable">{row.responsable || "—"}</td>
                            <td data-label="Notas">{row.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                      {(settlement.movimientos_caja || []).length > 0 && (
                        <tr className="inv-sheet-row">
                          <td data-label="" colSpan={4}><strong>Totales</strong></td>
                          <td data-label="Costo"><strong>{formatPrice(settlement.movimientos_costo_total ?? 0)}</strong></td>
                          <td data-label="Monto">
                            <strong className="inv-amount--in">{formatPrice(settlement.total_ingresos)}</strong>
                            {" / "}
                            <strong className="inv-amount--out">{formatPrice(settlement.total_egresos)}</strong>
                          </td>
                          <td colSpan={2} />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
              {...deviceFilterProps}
              dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}
            />
            <ReportFilterActions>
              <ReportPreviewButton onClick={openCashPreview} disabled={cashLoading || !cash} />
              <ReportPdfButton onClick={exportCashPdf} disabled={cashLoading || exporting || !cash} />
              <ReportExcelButton onClick={exportCashExcel} disabled={cashLoading || exporting || !cash} />
            </ReportFilterActions>
            {cashLoading && !cash ? <ReportLoader /> : null}
            {cash && (
              <div className="inv-panel__body">
                <p className="inv-dash__muted inv-report-methodology" style={{ marginTop: 0 }}>
                  {cash.methodology || "Cobros según fecha de pago. Las retomas aparecen como egresos. Las ventas devueltas no entran en ingresos del período."}
                </p>
                <MobileCollapsible summary="Resumen del libro de caja">
                <div className="inv-stats inv-stats--5 inv-report-stats">
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
                  <article className="inv-stat inv-stat--slate">
                    <span className="inv-stat__label">Costo total</span>
                    <strong className="inv-stat__value">{formatPrice(cash.total_cost ?? 0)}</strong>
                  </article>
                  <article className="inv-stat inv-stat--green">
                    <span className="inv-stat__label">Utilidad bruta</span>
                    <strong className="inv-stat__value">{formatPrice(cash.total_profit ?? 0)}</strong>
                  </article>
                  <article className="inv-stat inv-stat--amber">
                    <span className="inv-stat__label">Margen</span>
                    <strong className="inv-stat__value">{formatMargin(cash.margin_percent)}</strong>
                  </article>
                  {(cash.retake_outflows ?? 0) > 0 && (
                    <article className="inv-stat inv-stat--amber">
                      <span className="inv-stat__label">Pagos retoma</span>
                      <strong className="inv-stat__value">{formatPrice(-Math.abs(cash.retake_outflows))}</strong>
                    </article>
                  )}
                </div>
                </MobileCollapsible>
                <div className="inv-stats" style={{ marginTop: "1rem" }}>
                  <article className="inv-stat inv-stat--green">
                    <span className="inv-stat__label">Cobros ventas del período</span>
                    <strong className="inv-stat__value">{formatPrice(cash.collections_on_period_sales ?? 0)}</strong>
                  </article>
                  <article className="inv-stat inv-stat--purple">
                    <span className="inv-stat__label">Apartados y abonos previos</span>
                    <strong className="inv-stat__value">{formatPrice(cash.collections_on_other_sales ?? 0)}</strong>
                  </article>
                </div>
                <CollectionTypeBreakdown byType={cash.by_collection_type} />
                <PaymentMethodBreakdown
                  byMethod={cash.by_payment_method}
                  title="Neto del período por método"
                  amountLabel="Neto"
                />
                <CashLedgerTable ledger={cash.ledger} showDate={cashIsRange} />
              </div>
            )}
          </section>
        )}

        {tab === "receivables" && (
          <section className="inv-panel">
            <ReportFilters
              filters={filters}
              onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
              users={users}
              suppliers={suppliers}
              {...deviceFilterProps}
            />
            <ReportFilterActions>
              <ReportPreviewButton onClick={openReceivablesPreview} disabled={receivablesLoading || !receivables} />
              <ReportPdfButton onClick={exportReceivablesPdf} disabled={receivablesLoading || exporting || !receivables} />
              <ReportExcelButton onClick={exportReceivablesExcel} disabled={receivablesLoading || exporting || !receivables} />
            </ReportFilterActions>
            {receivablesLoading && !receivables ? <ReportLoader /> : null}
            {receivables && (
              <div className="inv-panel__body">
                <ReceivablesSummary totals={receivables.totals} methodology={receivables.methodology} />
                <ReceivablesTable items={receivables.items} />
              </div>
            )}
          </section>
        )}

        {tab === "intake" && (
          <section className="inv-panel">
            <ReportFilters
              filters={filters}
              onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
              suppliers={suppliers}
              {...deviceFilterProps}
              dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}
              searchPlaceholder="Equipo, IMEI o proveedor…"
              mode="intake"
            />
            <ReportFilterActions>
              <ReportPreviewButton onClick={openIntakePreview} disabled={intakeLoading || !intake} />
              <ReportPdfButton onClick={exportIntakePdf} disabled={intakeLoading || exporting || !intake} />
              <ReportExcelButton onClick={exportIntakeExcel} disabled={intakeLoading || exporting || !intake} />
            </ReportFilterActions>
            {intakeLoading && !intake ? <ReportLoader /> : null}
            {intake && (
              <div className="inv-panel__body">
                <IntakeReportSummary totals={intake.totals} methodology={intake.methodology} />
                <IntakeGroupedReport
                  groups={intake.by_supplier}
                  showDate={intakeIsRange || intake.is_range}
                />
              </div>
            )}
          </section>
        )}

        {tab === "service" && (
          <section className="inv-panel">
            <ReportFilters
              filters={filters}
              onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
              {...deviceFilterProps}
              serviceStates={serviceStates}
              workshops={workshops}
              dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}
              searchPlaceholder="Equipo, IMEI o cliente…"
              mode="service"
            />
            <ReportFilterActions>
              <ReportPreviewButton onClick={openServicePreview} disabled={serviceReportLoading || !serviceReport} />
              <ReportPdfButton onClick={exportServicePdf} disabled={serviceReportLoading || exporting || !serviceReport} />
              <ReportExcelButton onClick={exportServiceExcel} disabled={serviceReportLoading || exporting || !serviceReport} />
            </ReportFilterActions>
            {serviceReportLoading && !serviceReport ? <ReportLoader /> : null}
            {serviceReport && (
              <div className="inv-panel__body">
                <ServiceTicketsReportSummary totals={serviceReport.totals} methodology={serviceReport.methodology} />
                <ServiceTicketsReportTable
                  tickets={serviceReport.tickets}
                  showDate={serviceIsRange || serviceReport.is_range}
                />
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
                  <InvIcon name="download" />
                  Exportar inventario (CSV)
                </button>
              )}
              <button type="button" className="inv-btn inv-btn--outline" onClick={exportSales}>
                <InvIcon name="download" />
                Exportar ventas (CSV)
              </button>
              {canManageInventory(user) && (
                <label className="inv-btn inv-btn--primary inv-btn--inline" style={{ cursor: "pointer" }}>
                  <InvIcon name="upload" />
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

import React from "react";
import { Link, Navigate } from "react-router-dom";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import { useCachedQuery } from "../hooks/useCachedQuery.js";
import api, { isApiConfigured } from "../lib/apiClient";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import { canAccessInventory, canManageSales, formatPrice, isServiceTechnician } from "./inventario/shared.jsx";
import "../styles.css";

export default function InventarioDashboard() {
  const { user, authChecked, signOut } = useInventarioPage();
  const ready = authChecked && Boolean(user);

  const { data: payload, loading, refreshing, refetch } = useCachedQuery(
    ["dashboard"],
    () => api.bootstrapDashboard(),
    { enabled: ready },
  );

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

  if (!canAccessInventory(user) && !canManageSales(user)) {
    return <Navigate to="/admin" replace />;
  }

  const data = payload?.dashboard ?? null;
  const inv = data?.inventory ?? {};
  const sales = data?.sales ?? {};
  const showSkeleton = loading && !data;

  return (
    <div className="inv-dash">
      <InventarioTopbar
        current="dashboard"
        title="Dashboard"
        subtitle="Resumen operativo · Phone Colombia"
        user={user}
        onSignOut={signOut}
      />
      <main className="inv-main">
        {refreshing && (
          <p className="inv-dash__muted" style={{ marginBottom: "0.5rem", fontSize: "0.85rem" }}>Actualizando…</p>
        )}
        <div className="inv-stats inv-stats--5">
          <article className="inv-stat inv-stat--green">
            <span className="inv-stat__label">Disponibles</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : inv.disponible ?? 0}</strong>
          </article>
          <article className="inv-stat inv-stat--blue">
            <span className="inv-stat__label">Ventas hoy</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : sales.today_count ?? 0}</strong>
          </article>
          <article className="inv-stat inv-stat--purple">
            <span className="inv-stat__label">Ventas del mes</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : sales.month_count ?? 0}</strong>
          </article>
          <article className="inv-stat inv-stat--amber">
            <span className="inv-stat__label">Créditos pendientes</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : sales.pending_credits ?? 0}</strong>
          </article>
          <article className="inv-stat inv-stat--slate">
            <span className="inv-stat__label">En servicio técnico</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : inv.servicio_tecnico ?? 0}</strong>
          </article>
        </div>

        <div className="inv-stats inv-stats--5" style={{ marginTop: "1rem" }}>
          <article className="inv-stat inv-stat--slate">
            <span className="inv-stat__label">Total inventario</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : inv.total ?? 0}</strong>
          </article>
          <article className="inv-stat inv-stat--amber">
            <span className="inv-stat__label">Separados</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : inv.separado ?? 0}</strong>
          </article>
          <article className="inv-stat inv-stat--slate">
            <span className="inv-stat__label">Vendidos</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : inv.vendido ?? 0}</strong>
          </article>
          <article className="inv-stat inv-stat--purple">
            <span className="inv-stat__label">Retomados</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : inv.retomado ?? 0}</strong>
          </article>
          <article className="inv-stat inv-stat--green">
            <span className="inv-stat__label">Recaudado hoy</span>
            <strong className="inv-stat__value">{showSkeleton ? "…" : formatPrice(sales.revenue_today ?? 0)}</strong>
          </article>
        </div>

        <section className="inv-panel" style={{ marginTop: "1.5rem" }}>
          <h2 className="inv-panel__title">Accesos rápidos</h2>
          <div className="inv-sheet-actions" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
            <Link to="/admin/inventario" className="inv-btn inv-btn--outline">Ver inventario</Link>
            {canManageSales(user) && (
              <Link to="/admin/inventario/ventas" className="inv-btn inv-btn--primary inv-btn--inline">Registrar venta</Link>
            )}
            {canManageSales(user) && (
              <Link to="/admin/inventario/informes" className="inv-btn inv-btn--outline">Informes y caja</Link>
            )}
            <Link to="/admin/inventario/servicio-tecnico" className="inv-btn inv-btn--outline">Servicio técnico</Link>
            <button type="button" className="inv-btn inv-btn--ghost" onClick={refetch} disabled={loading || refreshing}>
              Actualizar
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

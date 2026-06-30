import React, { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import MobileCollapsible from "../components/inventario/MobileCollapsible.jsx";
import { useCachedQuery } from "../hooks/useCachedQuery.js";
import api, { isApiConfigured } from "../lib/apiClient";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import { canAccessInventory, canManageSales, formatPrice, isServiceTechnician } from "./inventario/shared.jsx";
import "../styles.css";

const SPARKLINE_COLORS = {
  green: "#059669",
  blue: "#2563eb",
  purple: "#7c3aed",
  amber: "#d97706",
  slate: "#64748b",
};

function pctChange(series) {
  if (!series?.length || series.length < 2) return null;
  const prev = Number(series[series.length - 2]) || 0;
  const last = Number(series[series.length - 1]) || 0;
  if (prev === 0) return last > 0 ? 100 : 0;
  return Math.round(((last - prev) / prev) * 1000) / 10;
}

function Sparkline({ data = [], color = "green", width = 140, height = 40 }) {
  const values = data.length ? data.map((v) => Number(v) || 0) : [0];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return [x, y];
  });

  const line = points.map((p) => p.join(",")).join(" ");
  const area = `M0,${height} L${points.map((p) => p.join(",")).join(" L")} L${width},${height} Z`;
  const stroke = SPARKLINE_COLORS[color] || color;

  return (
    <svg className="inv-stat__spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="inv-stat__spark-area" d={area} style={{ fill: stroke }} />
      <polyline className="inv-stat__spark-line" points={line} style={{ stroke }} />
    </svg>
  );
}

function MiniProgress({ value = 0, max = 1, color = "green" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="inv-stat__progress" aria-hidden="true">
      <div className="inv-stat__progress-track">
        <span className={`inv-stat__progress-fill inv-stat__progress-fill--${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="inv-stat__progress-labels">
        <span>{value}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function TrendBadge({ series }) {
  const change = pctChange(series);
  if (change === null) return <span className="inv-stat__trend inv-stat__trend--flat">—</span>;
  const up = change >= 0;
  return (
    <span className={`inv-stat__trend inv-stat__trend--${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(change)}%
    </span>
  );
}

function StatCard({
  period,
  label,
  value,
  tone,
  loading,
  chart,
  foot,
  trendSeries,
}) {
  return (
    <article className={`inv-stat inv-stat--chart inv-stat--${tone}`}>
      <span className="inv-stat__period">{period}</span>
      <span className="inv-stat__label">{label}</span>
      <strong className="inv-stat__value">{loading ? "…" : value}</strong>
      {!loading && chart}
      <div className="inv-stat__foot">
        <span className="inv-stat__context">{foot}</span>
        {!loading && trendSeries && <TrendBadge series={trendSeries} />}
      </div>
    </article>
  );
}

export default function InventarioDashboard() {
  const { user, authChecked, signOut } = useInventarioPage();
  const ready = authChecked && Boolean(user);

  const { data: payload, loading, refreshing, refetch } = useCachedQuery(
    ["dashboard"],
    () => api.bootstrapDashboard(),
    { enabled: ready },
  );

  const data = payload?.dashboard ?? null;
  const inv = data?.inventory ?? {};
  const sales = data?.sales ?? {};
  const trends = data?.trends ?? {};
  const showSkeleton = loading && !data;

  const total = inv.total ?? 0;
  const sales7 = trends.sales_count_7d ?? [];
  const revenue7 = trends.sales_revenue_7d ?? [];
  const added7 = trends.inventory_added_7d ?? [];

  const monthTarget = useMemo(() => {
    const peak = Math.max(...(sales7.length ? sales7 : [0]), sales.month_count ?? 0, 1);
    return Math.max(peak * 4, sales.month_count ?? 0, 1);
  }, [sales7, sales.month_count]);

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
          <p className="inv-dash__muted" style={{ marginBottom: "0.5rem", fontSize: "0.85rem" }}>
            Actualizando…
          </p>
        )}

        <MobileCollapsible summary="Indicadores del dashboard" className="inv-mobile-fold--inline">
        <div className="inv-stats inv-stats--5">
          <StatCard
            period="Inventario"
            label="Disponibles"
            value={inv.disponible ?? 0}
            tone="green"
            loading={showSkeleton}
            foot="del total activo"
            chart={<MiniProgress value={inv.disponible ?? 0} max={total || 1} color="green" />}
          />
          <StatCard
            period="Hoy"
            label="Ventas hoy"
            value={sales.today_count ?? 0}
            tone="blue"
            loading={showSkeleton}
            foot="últimos 7 días"
            trendSeries={sales7}
            chart={<Sparkline data={sales7} color="blue" />}
          />
          <StatCard
            period="Mes actual"
            label="Ventas del mes"
            value={sales.month_count ?? 0}
            tone="purple"
            loading={showSkeleton}
            foot="objetivo estimado"
            chart={<MiniProgress value={sales.month_count ?? 0} max={monthTarget} color="purple" />}
          />
          <StatCard
            period="Cartera"
            label="Créditos pendientes"
            value={sales.pending_credits ?? 0}
            tone="amber"
            loading={showSkeleton}
            foot={
              (sales.pending_credit_amount ?? 0) > 0
                ? formatPrice(sales.pending_credit_amount)
                : "sin saldo abierto"
            }
            chart={
              <MiniProgress
                value={sales.pending_credits ?? 0}
                max={Math.max(sales.month_count ?? 0, sales.pending_credits ?? 0, 1)}
                color="amber"
              />
            }
          />
          <StatCard
            period="Taller"
            label="En servicio técnico"
            value={inv.servicio_tecnico ?? 0}
            tone="slate"
            loading={showSkeleton}
            foot="del inventario"
            chart={<MiniProgress value={inv.servicio_tecnico ?? 0} max={total || 1} color="slate" />}
          />
        </div>

        <div className="inv-stats inv-stats--5" style={{ marginTop: "1rem" }}>
          <StatCard
            period="Stock"
            label="Total inventario"
            value={inv.total ?? 0}
            tone="slate"
            loading={showSkeleton}
            foot="ingresos 7 días"
            trendSeries={added7}
            chart={<Sparkline data={added7} color="slate" />}
          />
          <StatCard
            period="Reservas"
            label="Separados"
            value={inv.separado ?? 0}
            tone="amber"
            loading={showSkeleton}
            foot="del inventario"
            chart={<MiniProgress value={inv.separado ?? 0} max={total || 1} color="amber" />}
          />
          <StatCard
            period="Histórico"
            label="Vendidos"
            value={inv.vendido ?? 0}
            tone="slate"
            loading={showSkeleton}
            foot="del inventario"
            chart={<MiniProgress value={inv.vendido ?? 0} max={total || 1} color="slate" />}
          />
          <StatCard
            period="Retomas"
            label="Retomados"
            value={inv.retomado ?? 0}
            tone="purple"
            loading={showSkeleton}
            foot="del inventario"
            chart={<MiniProgress value={inv.retomado ?? 0} max={total || 1} color="purple" />}
          />
          <StatCard
            period="Hoy"
            label="Recaudado hoy"
            value={formatPrice(sales.collected_today ?? sales.revenue_today ?? 0)}
            tone="green"
            loading={showSkeleton}
            foot="cobros por fecha de pago"
            trendSeries={revenue7}
            chart={<Sparkline data={revenue7} color="green" />}
          />
        </div>
        </MobileCollapsible>

        <section className="inv-panel" style={{ marginTop: "1.5rem" }}>
          <h2 className="inv-panel__title">Accesos rápidos</h2>
          <div className="inv-sheet-actions" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
            <Link to="/admin/inventario" className="inv-btn inv-btn--outline">
              Ver inventario
            </Link>
            {canManageSales(user) && (
              <Link to="/admin/inventario/ventas" className="inv-btn inv-btn--primary inv-btn--inline">
                Registrar venta
              </Link>
            )}
            {canManageSales(user) && (
              <Link to="/admin/inventario/informes" className="inv-btn inv-btn--outline">
                Informes y caja
              </Link>
            )}
            <Link to="/admin/inventario/servicio-tecnico" className="inv-btn inv-btn--outline">
              Servicio técnico
            </Link>
            <button type="button" className="inv-btn inv-btn--ghost" onClick={refetch} disabled={loading || refreshing}>
              Actualizar
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

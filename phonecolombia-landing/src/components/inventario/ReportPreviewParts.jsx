import { formatPrice } from "../../pages/inventario/shared.jsx";

export function formatDateLabel(dateStr) {
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

export function formatMargin(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
}

export function formatSoldAt(soldAt) {
  if (!soldAt) return "—";
  return new Date(soldAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

const PAYMENT_LABELS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  credito: "Crédito",
  mixto: "Mixto",
};

const COLLECTION_TYPE_LABELS = {
  venta: "Cobro venta",
  apartado: "Abono apartado",
  abono: "Abono crédito",
  retoma: "Pago retoma",
  otro: "Cobro",
};

export function paymentLabel(method) {
  return PAYMENT_LABELS[method] ?? method ?? "—";
}

export function collectionTypeLabel(type) {
  return COLLECTION_TYPE_LABELS[type] ?? type ?? "—";
}

export function ReportPreviewHeader({ docLabel, docSubtitle, periodLabel, generatedAt }) {
  return (
    <header className="inv-report-doc__header">
      <div className="inv-report-doc__header-grid">
        <div className="inv-report-doc__brand">
          <p className="inv-report-doc__brand-name">Phone Colombia</p>
          <p className="inv-report-doc__brand-tagline">Tecnología móvil · Inventario y ventas</p>
        </div>
        <div className="inv-report-doc__doc-box">
          <p className="inv-report-doc__doc-label">{docLabel}</p>
          {docSubtitle && <p className="inv-report-doc__doc-sub">{docSubtitle}</p>}
          <p className="inv-report-doc__doc-period">{periodLabel}</p>
          {generatedAt && (
            <p className="inv-report-doc__doc-generated">Generado: {generatedAt}</p>
          )}
        </div>
      </div>
    </header>
  );
}

export function ReportPreviewMeta({ items }) {
  if (!items?.length) return null;
  return (
    <div className="inv-report-doc__meta-row">
      {items.map((item) => (
        <div key={item.label} className="inv-report-doc__meta-cell">
          <span className="inv-report-doc__meta-label">{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

const KPI_TONES = {
  blue: "#2563eb",
  purple: "#7c3aed",
  slate: "#64748b",
  green: "#059669",
  amber: "#d97706",
  orange: "#ea580c",
};

export function ReportPreviewKpis({ items }) {
  if (!items?.length) return null;
  return (
    <div className="inv-report-doc__kpis">
      {items.map((item) => (
        <article
          key={item.label}
          className="inv-report-doc__kpi"
          style={{ "--kpi-accent": KPI_TONES[item.tone] ?? KPI_TONES.slate }}
        >
          <span className="inv-report-doc__kpi-label">{item.label}</span>
          <strong className="inv-report-doc__kpi-value">{item.value}</strong>
        </article>
      ))}
    </div>
  );
}

export function ReportPreviewSection({ title, children, className = "" }) {
  return (
    <section className={`inv-report-doc__section ${className}`.trim()}>
      {title && <h2 className="inv-report-doc__section-title">{title}</h2>}
      {children}
    </section>
  );
}

export function ReportPreviewSellerBlock({ title, meta, children }) {
  return (
    <section className="inv-report-doc__seller-block">
      <h3 className="inv-report-doc__seller-name">{title}</h3>
      {meta && <p className="inv-report-doc__seller-meta">{meta}</p>}
      {children}
    </section>
  );
}

export function ReportPreviewMethodology({ text }) {
  if (!text) return null;
  return (
    <aside className="inv-report-doc__methodology">
      <span className="inv-report-doc__methodology-label">Metodología</span>
      <p>{text}</p>
    </aside>
  );
}

export function ReportPreviewEmpty({ children }) {
  return <p className="inv-report-doc__empty">{children}</p>;
}

export function ReportPreviewFooter() {
  return (
    <footer className="inv-report-doc__footer">
      <div className="inv-report-doc__footer-line" />
      <p>Phone Colombia · Documento gerencial</p>
      <p className="inv-report-doc__footer-note">
        No incluye impuestos ni gastos operativos. Utilidad bruta = precio de venta − costo del equipo.
      </p>
    </footer>
  );
}

export function reportMoney(value) {
  return formatPrice(value ?? 0);
}

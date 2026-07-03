import React, { useMemo } from "react";
import ColorSwatch from "../ColorSwatch.jsx";
import InvIcon from "./InvIcon.jsx";
import {
  describeInventoryMovement,
  formatPrice,
  MOVEMENT_TYPE_LABELS,
  STATUS_LABELS,
} from "../../pages/inventario/shared.jsx";

const MOVEMENT_TONES = {
  ingreso: "success",
  reingreso: "success",
  venta: "sale",
  retoma: "warning",
  status_change: "info",
  field_update: "neutral",
  archived: "muted",
};

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimelineSkeleton() {
  return (
    <div className="inv-history-timeline inv-history-timeline--loading" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="inv-history-event inv-history-event--skeleton">
          <div className="inv-history-event__rail">
            <span className="inv-skeleton inv-skeleton--dot" />
          </div>
          <div className="inv-history-event__card">
            <span className="inv-skeleton inv-skeleton--sm" style={{ width: "35%" }} />
            <span className="inv-skeleton inv-skeleton--md" style={{ width: "75%", marginTop: "0.5rem" }} />
            <span className="inv-skeleton inv-skeleton--xs" style={{ width: "45%", marginTop: "0.4rem" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryEvent({ movement, isLast }) {
  const tone = MOVEMENT_TONES[movement.type] || "neutral";
  const typeLabel = MOVEMENT_TYPE_LABELS[movement.type] || movement.type;
  const description = describeInventoryMovement(movement);
  const userName = movement.user?.name || "Sistema";

  return (
    <article className={`inv-history-event inv-history-event--${tone}${isLast ? " is-last" : ""}`}>
      <div className="inv-history-event__rail" aria-hidden="true">
        <span className="inv-history-event__dot" />
        {!isLast && <span className="inv-history-event__line" />}
      </div>
      <div className="inv-history-event__card">
        <div className="inv-history-event__head">
          <span className={`inv-history-event__type inv-history-event__type--${tone}`}>{typeLabel}</span>
          <time className="inv-history-event__date" dateTime={movement.created_at}>
            {formatDateTime(movement.created_at)}
          </time>
        </div>
        <p className="inv-history-event__desc">{description}</p>
        {movement.notes && movement.notes !== description && (
          <p className="inv-history-event__note">{movement.notes}</p>
        )}
        <div className="inv-history-event__foot">
          <span className="inv-history-event__user" title={userName}>
            <span className="inv-history-event__avatar" aria-hidden="true">
              {userName.charAt(0).toUpperCase()}
            </span>
            {userName}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function InventoryHistoryModal({ item, loading, onClose, showSensitive = true }) {
  const movements = useMemo(() => {
    const list = item?.movements || [];
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [item?.movements]);

  const titleId = "inv-history-title";

  return (
    <div className="inv-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="inv-modal inv-modal--history"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="inv-history-header">
          <div className="inv-history-header__main">
            <p className="inv-history-header__eyebrow">Historial del equipo</p>
            <h3 id={titleId} className="inv-history-header__title">
              {item?.color && <ColorSwatch name={item.color} size={16} />}
              {item?.name || "Equipo"}
            </h3>
          </div>
          <button type="button" className="inv-history-header__close" onClick={onClose} aria-label="Cerrar historial">
            ×
          </button>
        </header>

        {item && (
          <div className="inv-history-summary">
            <div className="inv-history-summary__item">
              <span className="inv-history-summary__label">Estado</span>
              <span className={`inv-badge inv-badge--${item.status}`}>
                {STATUS_LABELS[item.status] || item.status}
              </span>
            </div>
            {item.imei && (
              <div className="inv-history-summary__item">
                <span className="inv-history-summary__label">IMEI</span>
                <span className="inv-history-summary__value inv-cell-mono">{item.imei}</span>
              </div>
            )}
            {item.barcode && (
              <div className="inv-history-summary__item">
                <span className="inv-history-summary__label">Código</span>
                <span className="inv-history-summary__value inv-cell-mono">{item.barcode}</span>
              </div>
            )}
            {showSensitive && item.purchase_price != null && item.purchase_price !== "" && (
              <div className="inv-history-summary__item">
                <span className="inv-history-summary__label">Compra</span>
                <span className="inv-history-summary__value inv-price">{formatPrice(item.purchase_price)}</span>
              </div>
            )}
            {item.sale_price != null && item.sale_price !== "" && (
              <div className="inv-history-summary__item">
                <span className="inv-history-summary__label">Venta</span>
                <span className="inv-history-summary__value inv-price">{formatPrice(item.sale_price)}</span>
              </div>
            )}
            <div className="inv-history-summary__item">
              <span className="inv-history-summary__label">Eventos</span>
              <span className="inv-history-summary__value">{movements.length}</span>
            </div>
          </div>
        )}

        <div className="inv-history-body">
          {loading ? (
            <TimelineSkeleton />
          ) : movements.length === 0 ? (
            <div className="inv-history-empty">
              <span className="inv-history-empty__icon" aria-hidden="true">
                <InvIcon name="history" className="" />
              </span>
              <p className="inv-history-empty__title">Sin movimientos</p>
              <p className="inv-history-empty__text">Aún no hay cambios registrados para este equipo.</p>
            </div>
          ) : (
            <div className="inv-history-timeline">
              {movements.map((movement, index) => (
                <HistoryEvent key={movement.id} movement={movement} isLast={index === movements.length - 1} />
              ))}
            </div>
          )}
        </div>

        <div className="inv-modal__actions inv-history-actions">
          <button type="button" className="inv-btn inv-btn--outline" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

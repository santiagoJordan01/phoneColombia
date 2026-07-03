import { paymentLabel, paymentMethodBadgeClass } from "../../lib/paymentMethods.js";
import { formatPrice } from "../../pages/inventario/shared.jsx";
import { SERVICE_TICKET_TYPES } from "../../pages/inventario/shared.jsx";

export function PaymentMethodBadge({ method, suffix = null }) {
  if (!method) return <span className="inv-sheet-muted">—</span>;
  return (
    <span className="inv-table-badges">
      <span className={`inv-badge inv-badge--${paymentMethodBadgeClass(method)}`}>
        {paymentLabel(method)}
      </span>
      {suffix ? <span className="inv-sheet-muted" style={{ fontSize: "0.78rem" }}>{suffix}</span> : null}
    </span>
  );
}

export function SalePendingCell({ amountDue }) {
  const due = Number(amountDue) || 0;
  if (due <= 0) {
    return <span className="inv-sheet-muted">—</span>;
  }
  return (
    <span className="inv-badge inv-badge--pending inv-badge--mono">
      {formatPrice(due)}
    </span>
  );
}

export function SalePaidCell({ amountPaid, salePrice }) {
  const paid = Number(amountPaid) || 0;
  const price = Number(salePrice) || 0;
  const overpaid = price > 0 && paid > price;

  return (
    <span className="inv-table-badges">
      <span className={`inv-cell-mono${overpaid ? " inv-cell-money--loss" : ""}`}>
        {formatPrice(paid)}
      </span>
      {overpaid && (
        <span className="inv-badge inv-badge--overpaid" title="El pagado supera el precio de venta">
          Exceso
        </span>
      )}
    </span>
  );
}

export function TicketTypeBadge({ ticketType }) {
  if (!ticketType) return <span className="inv-sheet-muted">—</span>;
  const label = SERVICE_TICKET_TYPES[ticketType] || ticketType;
  return (
    <span className={`inv-badge inv-badge--ticket-${ticketType}`}>
      {label}
    </span>
  );
}

export function ServiceCostCell({ repairCost }) {
  if (repairCost == null || repairCost === "") {
    return <span className="inv-sheet-muted">—</span>;
  }
  return <span className="inv-cell-mono inv-cell-money--muted">{formatPrice(repairCost)}</span>;
}

export function ServiceCustomerPriceCell({ customerPrice, repairCost, isWarranty }) {
  if (isWarranty) {
    return <span className="inv-badge inv-badge--ticket-garantia">Sin cobro</span>;
  }
  if (customerPrice == null || customerPrice === "") {
    return <span className="inv-sheet-muted">—</span>;
  }
  const price = Number(customerPrice) || 0;
  const cost = Number(repairCost) || 0;
  const hasMargin = cost > 0 && price > 0;
  const profitable = hasMargin && price >= cost;

  return (
    <span className={`inv-cell-mono${hasMargin ? (profitable ? " inv-cell-money--profit" : " inv-cell-money--loss") : ""}`}>
      {formatPrice(price)}
    </span>
  );
}

export function serviceStatusSelectClass(status) {
  return status ? ` inv-st-status-select--${status}` : "";
}

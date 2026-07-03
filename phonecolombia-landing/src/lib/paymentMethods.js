export const PAYMENT_METHOD_LABELS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia bancaria",
  nequi: "Nequi",
  daviplata: "Daviplata",
  bancolombia: "Bancolombia",
  tarjeta: "Tarjeta / datáfono",
  credito: "Crédito",
  mixto: "Mixto",
};

const TRANSFER_METHODS = [
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "bancolombia", label: "Bancolombia" },
];

/** Cobros inmediatos (líneas mixtas, abonos, apartados, retomas). */
export const IMMEDIATE_PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  ...TRANSFER_METHODS,
  { value: "tarjeta", label: "Tarjeta / datáfono" },
];

/** Método principal de venta. */
export const SALE_PAYMENT_METHODS = [
  ...IMMEDIATE_PAYMENT_METHODS,
  { value: "credito", label: "Crédito" },
  { value: "mixto", label: "Mixto" },
];

/** Abono simple o mixto (sin crédito). */
export const ABONO_PAYMENT_METHODS = [
  ...IMMEDIATE_PAYMENT_METHODS,
  { value: "mixto", label: "Mixto" },
];

export const MIXED_LINE_PAYMENT_METHODS = IMMEDIATE_PAYMENT_METHODS;

/** Grupos para selects con optgroup. */
export const IMMEDIATE_PAYMENT_GROUPS = [
  { methods: [{ value: "efectivo", label: "Efectivo" }] },
  { label: "Transferencia", methods: TRANSFER_METHODS },
  { methods: [{ value: "tarjeta", label: "Tarjeta / datáfono" }] },
];

export const SALE_PAYMENT_GROUPS = [
  ...IMMEDIATE_PAYMENT_GROUPS,
  { methods: [{ value: "credito", label: "Crédito" }] },
  { methods: [{ value: "mixto", label: "Mixto" }] },
];

export const ABONO_PAYMENT_GROUPS = [
  ...IMMEDIATE_PAYMENT_GROUPS,
  { methods: [{ value: "mixto", label: "Mixto" }] },
];

export function paymentLabel(method) {
  return PAYMENT_METHOD_LABELS[method] ?? method ?? "—";
}

/** Clase inv-badge--pay-* para colorear método de pago en tablas. */
export function paymentMethodBadgeClass(method) {
  switch (method) {
    case "credito":
      return "pay-credito";
    case "mixto":
      return "pay-mixto";
    case "efectivo":
      return "pay-efectivo";
    case "tarjeta":
      return "pay-tarjeta";
    case "transferencia":
    case "nequi":
    case "daviplata":
    case "bancolombia":
      return "pay-transfer";
    default:
      return "pay-other";
  }
}

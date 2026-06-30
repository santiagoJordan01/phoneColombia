import { formatDaneLocation, resolveLocationFromSupplier } from "../../lib/daneLocations.js";

export const EMPTY_COLOR_FORM = { name: "" };

export const EMPTY_FORM = {
  imei: "",
  barcode: "",
  name: "",
  color: "",
  supplier: "",
  supplier_id: "",
  purchase_price: "",
  sale_price: "",
  battery: "",
  status: "disponible",
  notes: "",
  inventory_product_id: "",
  acquired_at: "",
};

export const CATEGORY_LABELS = {
  celular: "Celular",
  tablet: "Tablet",
  accesorio: "Accesorio",
  computador: "Computador",
  otro: "Otro",
};

export const EMPTY_EQUIPO_FORM = {
  brand: "",
  model: "",
  storage: "",
  color: "",
  category: "celular",
  reference_price: "",
  notes: "",
};

export const EMPTY_SUPPLIER_FORM = {
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  department_code: "",
  municipality_code: "",
  city: "",
  address: "",
  notes: "",
};

export const EMPTY_SERVICE_CUSTOMER_FORM = {
  name: "",
  phone: "",
  email: "",
  document: "",
  notes: "",
  is_active: true,
};

export function serviceCustomerToForm(customer) {
  return {
    name: customer.name || "",
    phone: customer.phone || "",
    email: customer.email || "",
    document: customer.document || "",
    notes: customer.notes || "",
    is_active: customer.is_active !== false,
  };
}

export function serviceCustomerSubtitle(c) {
  return [c.phone, c.document, c.email].filter(Boolean).join(" · ");
}

export function buildProductPreview({ brand, model, storage, color }) {
  return [brand, model, storage, color].filter(Boolean).join(" ").trim().toUpperCase();
}

export function productToEquipoForm(product) {
  return {
    brand: product.brand || "",
    model: product.model || "",
    storage: product.storage || "",
    color: product.color || "",
    category: product.category || "celular",
    reference_price: product.reference_price || "",
    notes: product.notes || "",
  };
}

export function supplierToForm(supplier) {
  const location = resolveLocationFromSupplier(supplier);
  return {
    name: supplier.name || "",
    contact_name: supplier.contact_name || "",
    phone: supplier.phone || "",
    email: supplier.email || "",
    department_code: location.department_code,
    municipality_code: location.municipality_code,
    city: location.city,
    address: supplier.address || "",
    notes: supplier.notes || "",
  };
}

export function supplierSubtitle(s) {
  const location = formatDaneLocation({
    departmentCode: s.department_code,
    municipalityCode: s.municipality_code,
    city: s.city,
  });
  const parts = [s.contact_name, s.phone, location].filter(Boolean);
  return parts.join(" · ");
}

export function formatPrice(value) {
  if (!value && value !== 0) return "";
  const raw = String(value).trim();
  if (raw.startsWith("$")) return raw;
  const num = Number(raw.replace(/[^\d.]/g, ""));
  if (Number.isNaN(num)) return raw;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export const CREDIT_TERM_OPTIONS = [
  { value: "8_days", label: "8 días" },
  { value: "15_days", label: "15 días" },
  { value: "custom", label: "Fecha de corte / personalizado" },
];

export function creditTermLabel(value) {
  return CREDIT_TERM_OPTIONS.find((o) => o.value === value)?.label ?? value ?? "—";
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`inv-field ${className}`}>
      <span className="inv-field__label">{label}</span>
      {children}
    </label>
  );
}

export const AJUSTES_SECTIONS = {
  usuarios: {
    title: "Usuarios",
    subtitle: "Cuentas, roles y contraseñas del panel",
  },
  auditoria: {
    title: "Auditoría",
    subtitle: "Registro de cambios en inventario, ventas y usuarios",
  },
  credito: {
    title: "Crédito y cobranza",
    subtitle: "Medios de pago de crédito (Addi, Sistecredito) y fecha de corte",
  },
};

/** Opciones avanzadas bajo Ajustes (solo administrador principal). */
export const AJUSTES_MENU = [
  {
    id: "usuarios",
    path: "/admin/inventario/ajustes/usuarios",
    label: "Usuarios",
    description: "Cuentas, roles y contraseñas del panel",
  },
  {
    id: "auditoria",
    path: "/admin/inventario/ajustes/auditoria",
    label: "Auditoría",
    description: "Quién cambió qué y cuándo",
  },
  {
    id: "credito",
    path: "/admin/inventario/ajustes/credito",
    label: "Crédito y cobranza",
    description: "Addi, Sistecredito y plazos de vencimiento",
  },
];

export const USER_ROLES = {
  super_admin: "Administrador principal",
  content: "Contenido (sitio web)",
  inventory: "Inventario",
  seller: "Vendedor (legacy)",
  asesor: "Asesor",
  service_technician: "Técnico de servicio técnico",
  supplier: "Proveedor / aliado",
};

export const USER_ROLE_HINTS = {
  super_admin: "Acceso total: contenido, inventario, ventas, informes y usuarios.",
  content: "Rol deshabilitado. El sitio web solo lo gestiona el administrador principal.",
  inventory: "Gestión completa de inventario, ventas, informes y servicio técnico.",
  seller: "Legacy — equivalente a asesor. Preferir rol Asesor en cuentas nuevas.",
  asesor: "Ventas, informes, consulta de inventario y gestión de tickets ST (sin CRUD inventario).",
  service_technician: "Solo consulta tickets ST asignados a su perfil de técnico (sin editar).",
  supplier: "Solo ve los equipos de su proveedor asignado.",
};

export const EMPTY_USER_FORM = {
  name: "",
  email: "",
  password: "",
  password_confirmation: "",
  role: "inventory",
  supplier_id: "",
  service_technician_id: "",
};

export const STATUS_LABELS = {
  disponible: "DISPONIBLE",
  servicio_tecnico: "SERVICIO TECNICO",
  separado: "SEPARADO",
  vendido: "VENDIDO",
  retomado: "RETOMADO",
  archived: "ARCHIVADO",
};

/** Estados que el usuario puede elegir al crear o editar manualmente. */
export const MANUAL_INVENTORY_STATUSES = ["disponible", "separado"];

export function editableInventoryStatuses(currentStatus) {
  if (MANUAL_INVENTORY_STATUSES.includes(currentStatus)) {
    return Object.fromEntries(
      MANUAL_INVENTORY_STATUSES.map((s) => [s, STATUS_LABELS[s]]),
    );
  }
  return null;
}

export const MOVEMENT_TYPE_LABELS = {
  ingreso: "Ingreso",
  field_update: "Actualización",
  status_change: "Cambio de estado",
  venta: "Venta",
  retoma: "Retoma",
  reingreso: "Reingreso",
  archived: "Archivado",
};

export const MOVEMENT_FIELD_LABELS = {
  status: "Estado",
  name: "Nombre",
  imei: "IMEI",
  barcode: "Código de barras",
  color: "Color",
  supplier: "Proveedor",
  supplier_id: "Proveedor",
  purchase_price: "Precio compra",
  sale_price: "Precio venta",
  battery: "Batería",
  notes: "Notas",
  acquired_at: "Fecha de ingreso",
  inventory_product_id: "Modelo de catálogo",
};

const PRICE_FIELDS = new Set(["purchase_price", "sale_price"]);

export function formatMovementValue(field, value) {
  if (value == null || value === "") return "—";
  if (field === "status") return STATUS_LABELS[value] || String(value).toUpperCase();
  if (PRICE_FIELDS.has(field)) return formatPrice(value) || value;
  return String(value);
}

export function describeInventoryMovement(movement) {
  const type = movement?.type || "";
  const field = movement?.field;
  const fieldLabel = field ? MOVEMENT_FIELD_LABELS[field] || field : null;
  const oldVal = formatMovementValue(field, movement?.old_value);
  const newVal = formatMovementValue(field, movement?.new_value);

  if (movement?.notes && !field) return movement.notes;

  if (type === "ingreso") return movement.notes || "Equipo ingresado al inventario";
  if (type === "venta") {
    const price = movement.meta?.sale_price ? formatPrice(movement.meta.sale_price) : null;
    return price ? `Venta registrada · ${price}` : movement.notes || "Venta registrada";
  }
  if (type === "retoma") {
    const saleRef = movement.meta?.sale_id ? ` · venta ${movement.meta.sale_id.slice(0, 8)}…` : "";
    return (movement.notes || `Retoma · ${oldVal} → ${newVal}`) + saleRef;
  }
  if (type === "reingreso") return movement.notes || `Reingreso · ${oldVal} → ${newVal}`;
  if (type === "archived") return movement.notes || "Equipo archivado";
  if (type === "status_change" && movement.meta?.ticket_id) {
    return movement.notes || `Servicio técnico · ${oldVal} → ${newVal}`;
  }

  if (field && oldVal !== "—" && newVal !== "—") {
    return `${fieldLabel}: ${oldVal} → ${newVal}`;
  }
  if (field && newVal !== "—") return `${fieldLabel}: ${newVal}`;
  if (movement?.notes) return movement.notes;

  return MOVEMENT_TYPE_LABELS[type] || type || "Movimiento";
}

export const SERVICE_TICKET_STATUS = {
  proceso_revision: "Proceso de revisión",
  esperando_repuestos: "Esperando repuestos",
  servicio_tecnico: "Servicio técnico",
  servicio_realizado: "Servicio realizado",
};

/** Etiquetas para estados legacy antes de la migración. */
export const SERVICE_TICKET_STATUS_LEGACY = {
  en_revision: "Proceso de revisión",
  en_reparacion: "Servicio técnico",
  listo: "Servicio realizado",
  entregado: "Servicio realizado",
  cancelado: "Proceso de revisión",
  ingresado: "Proceso de revisión",
};

export function serviceTicketStatusLabel(status) {
  return SERVICE_TICKET_STATUS[status] || SERVICE_TICKET_STATUS_LEGACY[status] || status;
}

export const SERVICE_TICKET_TYPES = {
  inventario: "Equipo de inventario",
  cliente_externo: "Equipo de cliente",
  garantia: "Garantía",
};

export const EMPTY_SERVICE_TICKET_FORM = {
  ticket_type: "inventario",
  inventory_item_id: "",
  service_customer_id: "",
  service_category_id: "",
  service_technician_id: "",
  device_name: "",
  device_reference: "",
  assigned_user_id: "",
  workshop: "",
  service_category: "",
  issue_description: "",
  repair_notes: "",
  repair_cost: "",
  customer_price: "",
  is_warranty: false,
  customer_name: "",
  customer_phone: "",
};

export function isSuperAdmin(user) {
  return user?.role === "super_admin" || Boolean(user?.is_admin);
}

export function canAccessInventory(user) {
  const role = user?.role;
  return (
    role === "super_admin" ||
    role === "inventory" ||
    role === "seller" ||
    role === "asesor" ||
    role === "supplier" ||
    Boolean(user?.is_admin)
  );
}

export function isServiceTechnician(user) {
  return user?.role === "service_technician";
}

export function isAsesor(user) {
  return user?.role === "asesor" || user?.role === "seller";
}

export function canAccessServiceTickets(user) {
  return canAccessInventory(user) || isServiceTechnician(user);
}

export function canManageServiceTickets(user) {
  const role = user?.role;
  return (
    role === "super_admin" ||
    role === "inventory" ||
    role === "seller" ||
    role === "asesor" ||
    Boolean(user?.is_admin)
  );
}

export function canEditServiceTicket(user) {
  return canManageServiceTickets(user);
}

export function canViewServiceTicket(user, ticket) {
  if (!user || !ticket) return false;
  if (canManageServiceTickets(user)) return true;
  if (!isServiceTechnician(user)) return false;
  if (ticket.assigned_user_id === user.id) return true;
  return Boolean(
    user.service_technician_id && ticket.service_technician_id === user.service_technician_id,
  );
}

export function getDefaultInventarioPath(user) {
  if (isServiceTechnician(user)) return "/admin/inventario/servicio-tecnico";
  return "/admin/inventario";
}

export function canManageSales(user) {
  const role = user?.role;
  return (
    role === "super_admin" ||
    role === "inventory" ||
    role === "seller" ||
    role === "asesor" ||
    Boolean(user?.is_admin)
  );
}

export function canManageCustomers(user) {
  return canManageSales(user);
}

export function canViewReports(user) {
  return canManageSales(user);
}

export function canManageInventory(user) {
  const role = user?.role;
  return role === "super_admin" || role === "inventory" || Boolean(user?.is_admin);
}

export function isSeller(user) {
  return user?.role === "seller";
}

export function canViewSensitiveInventoryFields(user) {
  if (!user) return true;
  return !isAsesor(user) && user?.role !== "supplier";
}

export function canAccessContent(user) {
  return isSuperAdmin(user);
}

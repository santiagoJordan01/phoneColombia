import { formatPrice, STATUS_LABELS, supplierSubtitle } from "../pages/inventario/shared.jsx";

export function inventoryItemSelectOptions(items, { showSensitive = true } = {}) {
  return (items || []).map((item) => {
    const meta = [];
    if (item.status === "separado") meta.push("Separado");
    if (item.active_reservation?.amount_paid > 0) {
      meta.push(`Abono ${formatPrice(item.active_reservation.amount_paid)}`);
    }
    else if (item.status && item.status !== "disponible") {
      meta.push(STATUS_LABELS[item.status] || item.status);
    }
    if (item.barcode) meta.push(item.barcode);
    if (showSensitive && item.imei) meta.push(`IMEI ${item.imei}`);
    if (item.sale_price) meta.push(formatPrice(item.sale_price));

    return {
      value: item.id,
      label: item.name,
      sublabel: meta.join(" · ") || undefined,
      searchText: [item.name, item.barcode, item.imei, item.color].filter(Boolean).join(" "),
    };
  });
}

export function supplierSelectOptions(suppliers) {
  return (suppliers || []).map((supplier) => ({
    value: supplier.id,
    label: supplier.name,
    sublabel: supplierSubtitle(supplier) || undefined,
    searchText: [supplier.name, supplier.phone, supplier.contact_name, supplier.city].filter(Boolean).join(" "),
  }));
}

export function catalogProductSelectOptions(products) {
  return (products || []).map((product) => {
    const meta = [product.storage].filter(Boolean);
    if (product.reference_price) meta.push(formatPrice(product.reference_price));
    return {
      value: product.id,
      label: product.name,
      sublabel: meta.join(" · ") || undefined,
      searchText: [product.name, product.brand, product.model, product.storage].filter(Boolean).join(" "),
    };
  });
}

export function userSelectOptions(users) {
  return (users || []).map((u) => ({
    value: u.id,
    label: u.name,
    sublabel: u.role ? String(u.role).replace(/_/g, " ") : undefined,
    searchText: [u.name, u.email, u.role].filter(Boolean).join(" "),
  }));
}

export function serviceTechnicianCatalogOptions(technicians) {
  return (technicians || []).map((t) => ({
    value: t.id,
    label: t.name,
    sublabel: [t.workshop, t.phone].filter(Boolean).join(" · ") || undefined,
    searchText: [t.name, t.workshop, t.phone].filter(Boolean).join(" "),
  }));
}

export function brandSelectOptions(brands) {
  return (brands || []).map((brand) => ({
    value: brand.name,
    label: brand.name,
    searchText: brand.name,
  }));
}

export function catalogModelSelectOptions(models, catalogProducts = [], brand = "") {
  const brandUpper = String(brand || "").toUpperCase();
  const isAppleBrand = brandUpper === "IPHONE" || brandUpper === "APPLE";

  if (!brandUpper) {
    return [];
  }

  if (!isAppleBrand) {
    const fromCatalog = (catalogProducts || [])
      .filter((p) => (p.brand || "").toUpperCase() === brandUpper && p.model)
      .map((p) => String(p.model).toUpperCase().trim());

    return [...new Set(fromCatalog)].map((model) => ({
      value: model,
      label: model,
      searchText: model,
    }));
  }

  const fromCatalog = (catalogProducts || [])
    .filter((p) => {
      const productBrand = (p.brand || "").toUpperCase();
      return (productBrand === "IPHONE" || productBrand === "APPLE") && p.model;
    })
    .map((p) => String(p.model).toUpperCase().trim());

  const merged = [...new Set([...(models || []), ...fromCatalog])];

  return merged.map((model) => ({
    value: model,
    label: model,
    searchText: model,
  }));
}

/** @deprecated Use catalogModelSelectOptions */
export function iphoneModelSelectOptions(models, catalogProducts = [], brand = "") {
  return catalogModelSelectOptions(models, catalogProducts, brand || "IPHONE");
}

export const IPHONE_STORAGE_OPTIONS = [
  "16GB",
  "32GB",
  "64GB",
  "128GB",
  "256GB",
  "512GB",
  "1TB",
].map((storage) => ({
  value: storage,
  label: storage,
  searchText: storage,
}));

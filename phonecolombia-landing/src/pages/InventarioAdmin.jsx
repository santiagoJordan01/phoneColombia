import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ColorSelect from "../components/ColorSelect.jsx";
import ColorSwatch from "../components/ColorSwatch.jsx";
import api, { isApiConfigured } from "../lib/apiClient";
import { getDeviceColorHex } from "../lib/deviceColorMap";
import "../styles.css";

const EMPTY_COLOR_FORM = { name: "" };

const CATEGORY_LABELS = {
  celular: "Celular",
  tablet: "Tablet",
  accesorio: "Accesorio",
  computador: "Computador",
  otro: "Otro",
};

const EMPTY_EQUIPO_FORM = {
  brand: "",
  model: "",
  storage: "",
  color: "",
  category: "celular",
  reference_price: "",
  notes: "",
};

const EMPTY_SUPPLIER_FORM = {
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  notes: "",
};

function buildProductPreview({ brand, model, storage, color }) {
  return [brand, model, storage, color].filter(Boolean).join(" ").trim().toUpperCase();
}

function productToEquipoForm(product) {
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

function supplierSubtitle(s) {
  const parts = [s.contact_name, s.phone, s.city].filter(Boolean);
  return parts.join(" · ");
}

const EMPTY_FORM = {
  imei: "",
  name: "",
  color: "",
  supplier: "",
  sale_price: "",
  battery: "",
  status: "disponible",
  notes: "",
  inventory_product_id: "",
};

const STATUS_LABELS = {
  disponible: "DISPONIBLE",
  servicio_tecnico: "SERVICIO TECNICO",
  separado: "SEPARADO",
  vendido: "VENDIDO",
  reservado: "SEPARADO",
};

const SEARCH_DEBOUNCE_MS = 400;

function formatPrice(value) {
  if (!value && value !== 0) return "";
  const raw = String(value).trim();
  if (raw.startsWith("$")) return raw;
  const num = Number(raw.replace(/[^\d.]/g, ""));
  if (Number.isNaN(num)) return raw;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(num);
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`inv-field ${className}`}>
      <span className="inv-field__label">{label}</span>
      {children}
    </label>
  );
}

function TableSkeleton({ rows = 8 }) {
  return (
    <tbody>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="inv-skeleton-row">
          <td><span className="inv-skeleton inv-skeleton--md" /></td>
          <td><span className="inv-skeleton inv-skeleton--lg" /></td>
          <td><span className="inv-skeleton inv-skeleton--xs" /></td>
          <td><span className="inv-skeleton inv-skeleton--sm" /></td>
          <td><span className="inv-skeleton inv-skeleton--md" /></td>
          <td><span className="inv-skeleton inv-skeleton--xs" /></td>
          <td><span className="inv-skeleton inv-skeleton--sm" /></td>
          <td><span className="inv-skeleton inv-skeleton--md" /></td>
          <td />
        </tr>
      ))}
    </tbody>
  );
}

export default function InventarioAdmin() {
  const navigate = useNavigate();
  const imeiInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [deviceColors, setDeviceColors] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [equipoForm, setEquipoForm] = useState(EMPTY_EQUIPO_FORM);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [colorForm, setColorForm] = useState(EMPTY_COLOR_FORM);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingEquipo, setCreatingEquipo] = useState(false);
  const [editingEquipoId, setEditingEquipoId] = useState(null);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [creatingColor, setCreatingColor] = useState(false);
  const [deletingSupplierId, setDeletingSupplierId] = useState(null);
  const [deletingColorId, setDeletingColorId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [searchDraft, setSearchDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [equipoModalOpen, setEquipoModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [colorModalOpen, setColorModalOpen] = useState(false);

  const hasActiveFilters = Boolean(filters.q || filters.status);

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

  useEffect(() => {
    if (!isApiConfigured) return;
    (async () => {
      if (!api.getToken()) {
        navigate("/admin");
        return;
      }
      try {
        const me = await api.me();
        setUser(me);
      } catch {
        api.clearToken();
        navigate("/admin");
      }
    })();
  }, [navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.q === searchDraft ? prev : { ...prev, q: searchDraft }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const fetchCatalogProducts = useCallback(async () => {
    try {
      const data = await api.getInventoryProducts();
      setCatalogProducts(data || []);
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [showToast]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const data = await api.getSuppliers();
      setSuppliers(data || []);
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [showToast]);

  const fetchDeviceColors = useCallback(async () => {
    try {
      const data = await api.getDeviceColors();
      setDeviceColors(data || []);
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [showToast]);

  const fetchItems = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await api.getInventory({
        q: filters.q || undefined,
        status: filters.status || undefined,
      });
      setItems(data || []);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setListLoading(false);
    }
  }, [filters.q, filters.status, showToast]);

  useEffect(() => {
    if (user) {
      fetchCatalogProducts();
      fetchSuppliers();
      fetchDeviceColors();
      fetchItems();
    }
  }, [user, fetchItems, fetchCatalogProducts, fetchSuppliers, fetchDeviceColors]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!deleteTarget && !itemModalOpen && !equipoModalOpen && !supplierModalOpen && !colorModalOpen) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (colorModalOpen && !creatingColor) setColorModalOpen(false);
      else if (supplierModalOpen && !creatingSupplier) setSupplierModalOpen(false);
      else if (equipoModalOpen && !creatingEquipo) closeEquipoModal();
      else if (itemModalOpen && !submitting) closeItemModal();
      else if (deleteTarget && !deletingId) setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget, itemModalOpen, equipoModalOpen, supplierModalOpen, colorModalOpen, creatingEquipo, creatingSupplier, creatingColor, submitting, deletingId]);

  const openNewItemModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setItemModalOpen(true);
    requestAnimationFrame(() => imeiInputRef.current?.focus());
  };

  const closeItemModal = () => {
    if (submitting) return;
    setItemModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      imei: item.imei || "",
      name: item.name || "",
      color: item.color || "",
      supplier: item.supplier || "",
      sale_price: item.sale_price || "",
      battery: item.battery ?? "",
      status: item.status || "disponible",
      notes: item.notes || "",
      inventory_product_id: item.inventory_product_id || "",
    });
    setItemModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        battery: form.battery === "" ? null : Number(form.battery),
      };
      if (editingId) {
        await api.updateInventoryItem(editingId, payload);
        showToast("Equipo actualizado");
      } else {
        await api.createInventoryItem(payload);
        showToast("Equipo agregado al inventario");
      }
      resetForm();
      setItemModalOpen(false);
      fetchItems();
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const closeEquipoModal = () => {
    if (creatingEquipo) return;
    setEquipoModalOpen(false);
    setEquipoForm(EMPTY_EQUIPO_FORM);
    setEditingEquipoId(null);
  };

  const openEquipoModal = () => {
    setEquipoForm(EMPTY_EQUIPO_FORM);
    setEditingEquipoId(null);
    setEquipoModalOpen(true);
  };

  const startEditEquipo = (product) => {
    setEditingEquipoId(product.id);
    setEquipoForm(productToEquipoForm(product));
  };

  const cancelEquipoEdit = () => {
    setEditingEquipoId(null);
    setEquipoForm(EMPTY_EQUIPO_FORM);
  };

  const handleSaveEquipo = async (e) => {
    e.preventDefault();
    const preview = buildProductPreview(equipoForm);
    if (!preview && !equipoForm.model.trim()) {
      showToast("Indica al menos el modelo del equipo", "error");
      return;
    }
    setCreatingEquipo(true);
    try {
      const payload = {
        brand: equipoForm.brand.trim() || undefined,
        model: equipoForm.model.trim() || undefined,
        storage: equipoForm.storage.trim() || undefined,
        color: equipoForm.color.trim() || undefined,
        category: equipoForm.category,
        reference_price: equipoForm.reference_price.trim() || undefined,
        notes: equipoForm.notes.trim() || undefined,
      };

      if (editingEquipoId) {
        const updated = await api.updateInventoryProduct(editingEquipoId, payload);
        await fetchCatalogProducts();
        setEditingEquipoId(null);
        setEquipoForm(EMPTY_EQUIPO_FORM);
        showToast(`Modelo "${updated.name}" actualizado`);
      } else {
        const created = await api.createInventoryProduct(payload);
        await fetchCatalogProducts();
        setForm((s) => ({
          ...s,
          name: created.name,
          color: created.color || "",
          sale_price: created.reference_price || s.sale_price,
          inventory_product_id: created.id,
        }));
        closeEquipoModal();
        showToast(`Modelo "${created.name}" guardado en catálogo`);
      }
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setCreatingEquipo(false);
    }
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;
    setCreatingSupplier(true);
    try {
      const created = await api.createSupplier({
        name: supplierForm.name.trim(),
        contact_name: supplierForm.contact_name.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
        email: supplierForm.email.trim() || undefined,
        city: supplierForm.city.trim() || undefined,
        address: supplierForm.address.trim() || undefined,
        notes: supplierForm.notes.trim() || undefined,
      });
      await fetchSuppliers();
      setForm((s) => ({ ...s, supplier: created.name }));
      setSupplierForm(EMPTY_SUPPLIER_FORM);
      showToast(`Proveedor "${created.name}" creado`);
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setCreatingSupplier(false);
    }
  };

  const handleCreateColor = async (e) => {
    e.preventDefault();
    if (!colorForm.name.trim()) return;
    setCreatingColor(true);
    try {
      const created = await api.createDeviceColor(colorForm.name.trim());
      await fetchDeviceColors();
      setColorForm(EMPTY_COLOR_FORM);
      showToast(`Color "${created.name}" agregado`);
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setCreatingColor(false);
    }
  };

  const removeColor = async (id, name) => {
    if (!confirm(`¿Eliminar el color "${name}"?`)) return;
    setDeletingColorId(id);
    try {
      await api.deleteDeviceColor(id);
      await fetchDeviceColors();
      showToast(`Color "${name}" eliminado`);
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setDeletingColorId(null);
    }
  };

  const removeSupplier = async (id, name) => {
    if (!confirm(`¿Eliminar el proveedor "${name}"?`)) return;
    setDeletingSupplierId(id);
    try {
      await api.deleteSupplier(id);
      await fetchSuppliers();
      showToast(`Proveedor "${name}" eliminado`);
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setDeletingSupplierId(null);
    }
  };

  const pickEquipoFromCatalog = (productId) => {
    const product = catalogProducts.find((p) => p.id === productId);
    if (!product) return;
    setForm((s) => ({
      ...s,
      inventory_product_id: product.id,
      name: product.name,
      color: product.color || "",
      sale_price: product.reference_price || s.sale_price,
    }));
  };

  const equipoPreview = buildProductPreview(equipoForm);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    try {
      await api.deleteInventoryItem(id);
      showToast(`"${deleteTarget.name}" eliminado`);
      if (editingId === id) {
        resetForm();
        setItemModalOpen(false);
      }
      setDeleteTarget(null);
      fetchItems();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => {
    setSearchDraft("");
    setFilters({ q: "", status: "" });
  };

  const signOut = async () => {
    await api.logout();
    navigate("/admin");
  };

  if (!isApiConfigured) {
    return (
      <div className="inv-dash inv-dash--centered">
        <p className="inv-dash__muted">Inventario — API no configurada</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
        <p className="inv-dash__muted">Verificando sesión…</p>
      </div>
    );
  }

  const countByStatus = (status) => items.filter((i) => i.status === status).length;
  const isInitialLoad = listLoading && items.length === 0;
  const isFilteredEmpty = !listLoading && items.length === 0 && hasActiveFilters;
  const equipoSuggestions = catalogProducts.map((p) => p.name);

  return (
    <div className="inv-dash">
      <header className="inv-topbar">
        <div className="inv-topbar__brand">
          <span className="inv-topbar__icon" aria-hidden="true">
            <img
              src={`${import.meta.env.BASE_URL}imagenes/logo-blanco-rojo.jfif`}
              alt=""
              className="inv-topbar__logo"
            />
          </span>
          <div>
            <h1 className="inv-topbar__title">Inventario</h1>
            <p className="inv-topbar__subtitle">Gestión de equipos · Phone Colombia</p>
          </div>
        </div>
        <nav className="inv-topbar__nav">
          <Link to="/admin" className="inv-btn inv-btn--ghost">Panel de contenido</Link>
          <button type="button" className="inv-btn inv-btn--outline" onClick={signOut}>Cerrar sesión</button>
        </nav>
      </header>

      <main className="inv-main inv-main--sheet">
        <div className="inv-stats inv-stats--5" aria-live="polite">
          <article className="inv-stat inv-stat--blue">
            <span className="inv-stat__label">Equipos</span>
            <strong className="inv-stat__value">{listLoading ? "…" : items.length}</strong>
          </article>
          <article className="inv-stat inv-stat--green">
            <span className="inv-stat__label">Disponible</span>
            <strong className="inv-stat__value">{listLoading ? "…" : countByStatus("disponible")}</strong>
          </article>
          <article className="inv-stat inv-stat--amber">
            <span className="inv-stat__label">Servicio técnico</span>
            <strong className="inv-stat__value">{listLoading ? "…" : countByStatus("servicio_tecnico")}</strong>
          </article>
          <article className="inv-stat inv-stat--purple">
            <span className="inv-stat__label">Separado</span>
            <strong className="inv-stat__value">{listLoading ? "…" : countByStatus("separado")}</strong>
          </article>
          <article className="inv-stat inv-stat--slate">
            <span className="inv-stat__label">Vendido</span>
            <strong className="inv-stat__value">{listLoading ? "…" : countByStatus("vendido")}</strong>
          </article>
        </div>

        <section className={`inv-panel inv-panel--sheet ${listLoading && items.length > 0 ? "is-refreshing" : ""}`}>
          <div className="inv-sheet-toolbar">
            <div className="inv-filters inv-filters--sheet">
              <form
                className="inv-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFilters((prev) => ({ ...prev, q: searchDraft }));
                }}
              >
                <svg className="inv-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3-3" />
                </svg>
                <input
                  className="inv-search__input"
                  placeholder="Buscar IMEI, equipo, proveedor…"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  aria-label="Buscar"
                />
                {searchDraft && (
                  <button type="button" className="inv-search__clear" onClick={() => setSearchDraft("")} aria-label="Limpiar">×</button>
                )}
              </form>
              <select
                className="inv-filter-select"
                value={filters.status}
                onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}
                aria-label="Filtrar por estado"
              >
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {hasActiveFilters && (
                <button type="button" className="inv-btn inv-btn--ghost inv-btn--compact" onClick={clearFilters}>
                  Limpiar
                </button>
              )}
            </div>
            <div className="inv-sheet-actions">
              <button
                type="button"
                className="inv-btn inv-btn--outline"
                onClick={() => { setColorForm(EMPTY_COLOR_FORM); setColorModalOpen(true); }}
              >
                + Color
              </button>
              <button
                type="button"
                className="inv-btn inv-btn--outline"
                onClick={() => { setSupplierForm(EMPTY_SUPPLIER_FORM); setSupplierModalOpen(true); }}
              >
                + Proveedor
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={openEquipoModal}>
                + Modelo
              </button>
              <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openNewItemModal}>
                + Agregar equipo
              </button>
              <button
                type="button"
                className="inv-btn inv-btn--icon"
                onClick={fetchItems}
                disabled={listLoading}
                title="Actualizar"
                aria-label="Actualizar"
              >
                <svg className={listLoading ? "inv-spin" : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-9-9" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            </div>
          </div>

          <div className="inv-table-wrap inv-table-wrap--sheet">
            <table className="inv-table inv-table--sheet">
              <thead>
                <tr>
                  <th>IMEI / Ref.</th>
                  <th>Equipo</th>
                  <th>Color</th>
                  <th>Proveedor</th>
                  <th>Precio</th>
                  <th>Batería</th>
                  <th>Estado</th>
                  <th>Observaciones</th>
                  <th />
                </tr>
              </thead>
              {isInitialLoad ? (
                <TableSkeleton />
              ) : items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={9} className="inv-sheet-empty">
                      <p>{isFilteredEmpty ? "Sin resultados para los filtros aplicados." : "No hay equipos registrados."}</p>
                      {!isFilteredEmpty && (
                        <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openNewItemModal}>
                          Agregar primer equipo
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`inv-sheet-row is-clickable ${editingId === item.id ? "is-editing" : ""} ${item.color ? "has-color" : ""}`}
                      style={item.color ? { "--inv-row-accent": getDeviceColorHex(item.color) } : undefined}
                      onClick={() => startEdit(item)}
                      title="Clic para editar"
                    >
                      <td data-label="IMEI / Ref.">
                        <span className="inv-sheet-imei">{item.imei || "—"}</span>
                      </td>
                      <td data-label="Equipo">
                        <span className="inv-sheet-equipo">{item.name}</span>
                      </td>
                      <td data-label="Color">
                        {item.color ? (
                          <span className="inv-color-badge">
                            <ColorSwatch name={item.color} size={20} />
                            <span className="inv-color-badge__label">{item.color}</span>
                          </span>
                        ) : (
                          <span className="inv-sheet-muted">—</span>
                        )}
                      </td>
                      <td data-label="Proveedor">
                        <span className="inv-sheet-supplier">{item.supplier || ""}</span>
                      </td>
                      <td data-label="Precio">
                        <span className="inv-sheet-price">{formatPrice(item.sale_price)}</span>
                      </td>
                      <td data-label="Batería">
                        <span className={`inv-sheet-battery ${item.battery != null && item.battery < 85 ? "is-low" : ""}`}>
                          {item.battery != null && item.battery !== "" ? `${item.battery}%` : ""}
                        </span>
                      </td>
                      <td data-label="Estado">
                        <span className={`inv-badge inv-badge--${item.status}`}>
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                      </td>
                      <td data-label="Observaciones">
                        <span className="inv-sheet-notes">{item.notes || ""}</span>
                      </td>
                      <td data-label="Acciones" onClick={(e) => e.stopPropagation()}>
                        <div className="inv-row-actions">
                          <button type="button" className="inv-icon-btn" title="Editar" onClick={() => startEdit(item)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="inv-icon-btn inv-icon-btn--danger"
                            title="Eliminar"
                            disabled={deletingId === item.id}
                            onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                          >
                            {deletingId === item.id ? (
                              <span className="inv-loader inv-loader--sm" />
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </section>
      </main>

      {itemModalOpen && (
        <div className="inv-modal-overlay" role="presentation" onClick={() => !submitting && closeItemModal()}>
          <div
            className="inv-modal inv-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inv-item-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="inv-item-title" className="inv-modal__title">
              {editingId ? "Editar equipo" : "Agregar equipo"}
            </h3>
            <form onSubmit={handleSubmit} className="inv-modal-form inv-modal-form--grid">
              <Field label="IMEI / Ref.">
                <input
                  ref={imeiInputRef}
                  className="inv-field__input inv-field__input--mono"
                  placeholder="353906107695406 o 0108"
                  value={form.imei}
                  onChange={(e) => setForm((s) => ({ ...s, imei: e.target.value }))}
                  autoComplete="off"
                />
              </Field>

              {catalogProducts.length > 0 && (
                <Field label="Cargar del catálogo (opcional)" className="inv-field--span-all">
                  <select
                    className="inv-field__input"
                    value={form.inventory_product_id}
                    onChange={(e) => pickEquipoFromCatalog(e.target.value)}
                    aria-label="Elegir modelo del catálogo"
                  >
                    <option value="">Seleccionar modelo guardado…</option>
                    {catalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Equipo *" className="inv-field--span-all">
                <input
                  className="inv-field__input"
                  list="equipo-suggestions"
                  placeholder="11 PRO MAX 256GB DORADO"
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value.toUpperCase(), inventory_product_id: "" }))}
                  required
                  autoComplete="off"
                />
                <datalist id="equipo-suggestions">
                  {equipoSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>

              <Field label="Color">
                <ColorSelect
                  value={form.color}
                  onChange={(color) => setForm((s) => ({ ...s, color }))}
                  colors={deviceColors}
                  placeholder="Seleccionar color…"
                />
              </Field>

              <Field label="Proveedor">
                <select
                  className="inv-field__input"
                  value={form.supplier}
                  onChange={(e) => setForm((s) => ({ ...s, supplier: e.target.value }))}
                  aria-label="Seleccionar proveedor"
                >
                  <option value="">
                    {suppliers.length === 0 ? "Crea proveedores con + Proveedor" : "Sin proveedor"}
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Precio">
                <input
                  className="inv-field__input"
                  inputMode="numeric"
                  placeholder="$1,300,000"
                  value={form.sale_price}
                  onChange={(e) => setForm((s) => ({ ...s, sale_price: e.target.value }))}
                />
              </Field>

              <Field label="Batería (%)">
                <input
                  className="inv-field__input"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="100"
                  value={form.battery}
                  onChange={(e) => setForm((s) => ({ ...s, battery: e.target.value }))}
                />
              </Field>

              <Field label="Estado">
                <select
                  className="inv-field__input"
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>

              <Field label="Observaciones" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  placeholder="PANTALLA FANTASMA, BATERIA, SOLO SIM MOVISTAR…"
                  value={form.notes}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                  rows={2}
                />
              </Field>

              <div className="inv-modal__actions inv-field--span-all">
                <button type="button" className="inv-btn inv-btn--outline" onClick={closeItemModal} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={submitting}>
                  {submitting ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar equipo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {colorModalOpen && (
        <div className="inv-modal-overlay" role="presentation" onClick={() => !creatingColor && setColorModalOpen(false)}>
          <div
            className="inv-modal inv-modal--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inv-color-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="inv-color-title" className="inv-modal__title">Colores disponibles</h3>
            <p className="inv-modal__text">
              Administra los colores que aparecen al registrar equipos en el inventario.
            </p>
            <form onSubmit={handleCreateColor} className="inv-modal-form">
              <Field label="Nuevo color">
                <input
                  className="inv-field__input"
                  placeholder="NEGRO"
                  value={colorForm.name}
                  onChange={(e) => setColorForm({ name: e.target.value.toUpperCase() })}
                  required
                  autoFocus
                  autoComplete="off"
                />
              </Field>
              <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={creatingColor}>
                {creatingColor ? "Guardando…" : "Agregar color"}
              </button>
            </form>
            {deviceColors.length > 0 && (
              <div className="inv-supplier-list">
                <p className="inv-supplier-list__title">Catálogo ({deviceColors.length})</p>
                <ul className="inv-supplier-list__items inv-supplier-list__items--tall">
                  {deviceColors.map((c) => (
                    <li key={c.id} className="inv-supplier-list__item">
                      <span className="inv-supplier-list__name">
                        <ColorSwatch name={c.name} size={14} />
                        {c.name}
                      </span>
                      <button
                        type="button"
                        className="inv-supplier-list__remove"
                        onClick={() => removeColor(c.id, c.name)}
                        disabled={deletingColorId === c.id}
                        aria-label={`Eliminar ${c.name}`}
                      >
                        {deletingColorId === c.id ? "…" : "×"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="inv-modal__actions inv-modal__actions--solo">
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => setColorModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {supplierModalOpen && (
        <div className="inv-modal-overlay" role="presentation" onClick={() => !creatingSupplier && setSupplierModalOpen(false)}>
          <div
            className="inv-modal inv-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inv-supplier-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="inv-supplier-title" className="inv-modal__title">Proveedores</h3>
            <p className="inv-modal__text">
              Registra la información del proveedor para usarla al ingresar equipos al inventario.
            </p>
            <form onSubmit={handleCreateSupplier} className="inv-modal-form inv-modal-form--grid">
              <Field label="Nombre / Empresa *">
                <input
                  className="inv-field__input"
                  placeholder="RETOMA"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm((s) => ({ ...s, name: e.target.value.toUpperCase() }))}
                  required
                  autoFocus
                  autoComplete="off"
                />
              </Field>
              <Field label="Persona de contacto">
                <input
                  className="inv-field__input"
                  placeholder="Juan Pérez"
                  value={supplierForm.contact_name}
                  onChange={(e) => setSupplierForm((s) => ({ ...s, contact_name: e.target.value }))}
                  autoComplete="off"
                />
              </Field>
              <Field label="Teléfono">
                <input
                  className="inv-field__input"
                  type="tel"
                  placeholder="300 123 4567"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm((s) => ({ ...s, phone: e.target.value }))}
                  autoComplete="off"
                />
              </Field>
              <Field label="Correo">
                <input
                  className="inv-field__input"
                  type="email"
                  placeholder="contacto@proveedor.com"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm((s) => ({ ...s, email: e.target.value }))}
                  autoComplete="off"
                />
              </Field>
              <Field label="Ciudad">
                <input
                  className="inv-field__input"
                  placeholder="Bogotá"
                  value={supplierForm.city}
                  onChange={(e) => setSupplierForm((s) => ({ ...s, city: e.target.value }))}
                  autoComplete="off"
                />
              </Field>
              <Field label="Dirección">
                <input
                  className="inv-field__input"
                  placeholder="Calle 123 #45-67"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm((s) => ({ ...s, address: e.target.value }))}
                  autoComplete="off"
                />
              </Field>
              <Field label="Notas" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  placeholder="Horarios, formas de pago, observaciones…"
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm((s) => ({ ...s, notes: e.target.value }))}
                  rows={2}
                />
              </Field>
              <div className="inv-field--span-all">
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={creatingSupplier}>
                  {creatingSupplier ? "Guardando…" : "Agregar proveedor"}
                </button>
              </div>
            </form>

            {suppliers.length > 0 && (
              <div className="inv-supplier-list">
                <p className="inv-supplier-list__title">Registrados ({suppliers.length})</p>
                <ul className="inv-supplier-list__items">
                  {suppliers.map((s) => (
                    <li key={s.id} className="inv-supplier-list__item">
                      <div className="inv-supplier-list__info">
                        <span className="inv-supplier-list__name">{s.name}</span>
                        {supplierSubtitle(s) && (
                          <span className="inv-supplier-list__meta">{supplierSubtitle(s)}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="inv-supplier-list__remove"
                        onClick={() => removeSupplier(s.id, s.name)}
                        disabled={deletingSupplierId === s.id}
                        aria-label={`Eliminar ${s.name}`}
                      >
                        {deletingSupplierId === s.id ? "…" : "×"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="inv-modal__actions inv-modal__actions--solo">
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => setSupplierModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {equipoModalOpen && (
        <div className="inv-modal-overlay" role="presentation" onClick={closeEquipoModal}>
          <div
            className="inv-modal inv-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inv-equipo-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="inv-equipo-title" className="inv-modal__title">
              {editingEquipoId ? "Editar modelo" : "Modelos de equipo (catálogo)"}
            </h3>
            <p className="inv-modal__text">
              {editingEquipoId
                ? "Modifica los datos del modelo. El nombre se actualiza automáticamente."
                : "Define marca, modelo, almacenamiento y color. El nombre se genera automáticamente como en tu hoja de inventario."}
            </p>
            <form onSubmit={handleSaveEquipo} className="inv-modal-form inv-modal-form--grid">
              <Field label="Marca">
                <input
                  className="inv-field__input"
                  placeholder="Apple"
                  value={equipoForm.brand}
                  onChange={(e) => setEquipoForm((s) => ({ ...s, brand: e.target.value }))}
                  autoFocus
                  autoComplete="off"
                />
              </Field>
              <Field label="Modelo *">
                <input
                  className="inv-field__input"
                  placeholder="13 PRO MAX"
                  value={equipoForm.model}
                  onChange={(e) => setEquipoForm((s) => ({ ...s, model: e.target.value.toUpperCase() }))}
                  required
                  autoComplete="off"
                />
              </Field>
              <Field label="Almacenamiento">
                <input
                  className="inv-field__input"
                  placeholder="256GB"
                  value={equipoForm.storage}
                  onChange={(e) => setEquipoForm((s) => ({ ...s, storage: e.target.value.toUpperCase() }))}
                  autoComplete="off"
                />
              </Field>
              <Field label="Color">
                <ColorSelect
                  value={equipoForm.color}
                  onChange={(color) => setEquipoForm((s) => ({ ...s, color }))}
                  colors={deviceColors}
                  placeholder="Seleccionar color…"
                />
              </Field>
              <Field label="Categoría">
                <select
                  className="inv-field__input"
                  value={equipoForm.category}
                  onChange={(e) => setEquipoForm((s) => ({ ...s, category: e.target.value }))}
                >
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Precio referencia">
                <input
                  className="inv-field__input"
                  inputMode="numeric"
                  placeholder="$1,780,000"
                  value={equipoForm.reference_price}
                  onChange={(e) => setEquipoForm((s) => ({ ...s, reference_price: e.target.value }))}
                />
              </Field>
              <Field label="Notas" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  placeholder="Variante, observaciones del modelo…"
                  value={equipoForm.notes}
                  onChange={(e) => setEquipoForm((s) => ({ ...s, notes: e.target.value }))}
                  rows={2}
                />
              </Field>
              {equipoPreview && (
                <p className="inv-product-preview inv-field--span-all">
                  Vista previa: <strong>{equipoPreview}</strong>
                </p>
              )}
              <div className="inv-modal__actions inv-field--span-all">
                <button
                  type="button"
                  className="inv-btn inv-btn--outline"
                  onClick={editingEquipoId ? cancelEquipoEdit : closeEquipoModal}
                  disabled={creatingEquipo}
                >
                  {editingEquipoId ? "Cancelar edición" : "Cerrar"}
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={creatingEquipo}>
                  {creatingEquipo ? "Guardando…" : editingEquipoId ? "Actualizar modelo" : "Guardar modelo"}
                </button>
              </div>
            </form>

            {catalogProducts.length > 0 && (
              <div className="inv-supplier-list">
                <p className="inv-supplier-list__title">Catálogo ({catalogProducts.length}) — clic para editar</p>
                <ul className="inv-supplier-list__items inv-supplier-list__items--tall">
                  {catalogProducts.map((p) => (
                    <li
                      key={p.id}
                      className={`inv-supplier-list__item inv-supplier-list__item--clickable ${editingEquipoId === p.id ? "is-selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="inv-supplier-list__pick"
                        onClick={() => startEditEquipo(p)}
                        disabled={creatingEquipo}
                      >
                        <div className="inv-supplier-list__info">
                          <span className="inv-supplier-list__name">
                            {p.color && <ColorSwatch name={p.color} size={14} />}
                            {p.name}
                          </span>
                          <span className="inv-supplier-list__meta">
                            {[CATEGORY_LABELS[p.category], p.reference_price && formatPrice(p.reference_price)].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`inv-toast inv-toast--${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
          <span className="inv-toast__text">{toast.text}</span>
          <button type="button" className="inv-toast__close" onClick={() => setToast(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      {deleteTarget && (
        <div className="inv-modal-overlay" role="presentation" onClick={() => !deletingId && setDeleteTarget(null)}>
          <div className="inv-modal" role="dialog" aria-modal="true" aria-labelledby="inv-delete-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="inv-delete-title" className="inv-modal__title">¿Eliminar equipo?</h3>
            <p className="inv-modal__text">
              Se eliminará <strong>{deleteTarget.name}</strong> del inventario.
            </p>
            <div className="inv-modal__actions">
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingId)}>
                Cancelar
              </button>
              <button type="button" className="inv-btn inv-btn--danger" onClick={confirmDelete} disabled={Boolean(deletingId)}>
                {deletingId ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

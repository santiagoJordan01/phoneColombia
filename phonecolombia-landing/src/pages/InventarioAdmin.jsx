import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import DaneLocationFields from "../components/DaneLocationFields.jsx";
import ColorSelect from "../components/ColorSelect.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import ColorSwatch from "../components/ColorSwatch.jsx";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import MobileCollapsible from "../components/inventario/MobileCollapsible.jsx";
import ConfirmDeleteDialog from "../components/inventario/ConfirmDeleteDialog.jsx";
import CurrencyInput from "../components/inventario/CurrencyInput.jsx";
import InventoryHistoryModal from "../components/inventario/InventoryHistoryModal.jsx";
import InvIcon from "../components/inventario/InvIcon.jsx";
import { PaymentMethodBadge } from "../components/inventario/TableValueDisplay.jsx";
import PaymentMethodSelect from "../components/inventario/PaymentMethodSelect.jsx";
import { IMMEDIATE_PAYMENT_GROUPS, paymentLabel } from "../lib/paymentMethods.js";
import { useCachedQuery } from "../hooks/useCachedQuery.js";
import api, { isApiConfigured } from "../lib/apiClient";
import { invalidateInventarioCache } from "../lib/inventarioCache.js";
import iphoneModels from "../data/iphone-models.json";
import { locationPayload, municipalityLabel } from "../lib/daneLocations.js";
import { getCanonicalColorName, getDeviceColorHex } from "../lib/deviceColorMap";
import { catalogProductSelectOptions, brandSelectOptions, catalogModelSelectOptions, IPHONE_STORAGE_OPTIONS, supplierSelectOptions } from "../lib/inventarioSelectOptions.js";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import {
  CATEGORY_LABELS,
  EMPTY_EQUIPO_FORM,
  EMPTY_FORM,
  EMPTY_SUPPLIER_FORM,
  EMPTY_COLOR_FORM,
  EMPTY_BRAND_FORM,
  Field,
  STATUS_LABELS,
  editableInventoryStatuses,
  buildCatalogPreview,
  buildInventoryItemName,
  formatInventoryIdentifier,
  applyInventoryIdentifierInput,
  canAccessContent,
  canAccessInventory,
  canManageInventory,
  canManageSales,
  isAccountant,
  canViewSensitiveInventoryFields,
  formatPrice,
  isServiceTechnician,
  parseCop,
  productToEquipoForm,
  productToItemCatalogFields,
  supplierSubtitle,
  supplierToForm,
} from "./inventario/shared.jsx";
import "../styles.css";

const SEARCH_DEBOUNCE_MS = 400;

function formatArchivedAt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAcquiredAt(item) {
  const iso = item.acquired_at || item.created_at;
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inventorySalePaymentMethod(item) {
  if (item.status === "vendido") return item.latest_sale?.payment_method ?? null;
  if (item.status === "separado") return item.active_reservation?.payment_method ?? null;
  return null;
}

const INVENTORY_SORT_COLUMNS = [
  {
    id: "identifier",
    label: "Cód. barras / IMEI",
    getValue: (item) => item.imei || item.barcode || "",
  },
  {
    id: "equipo",
    label: "Equipo",
    getValue: (item) => item.name || "",
  },
  {
    id: "color",
    label: "Color",
    getValue: (item) => item.color || "",
  },
  {
    id: "proveedor",
    label: "Proveedor",
    getValue: (item) => item.supplier || "",
  },
  {
    id: "precio",
    label: "Precio",
    getValue: (item) => parseCop(item.sale_price),
  },
  {
    id: "fecha_ingreso",
    label: "Fecha ingreso",
    getValue: (item) => new Date(item.acquired_at || item.created_at || 0).getTime(),
  },
  {
    id: "bateria",
    label: "Batería",
    getValue: (item) => (item.battery != null && item.battery !== "" ? Number(item.battery) : NaN),
  },
  {
    id: "estado",
    label: "Estado",
    getValue: (item) => (item.is_archived ? "archived" : item.status || ""),
  },
  {
    id: "metodo_venta",
    label: "Método venta",
    getValue: (item) => paymentLabel(inventorySalePaymentMethod(item) || ""),
  },
  {
    id: "archivado",
    label: "Archivado el",
    archivedOnly: true,
    getValue: (item) => new Date(item.deleted_at || 0).getTime(),
  },
  {
    id: "observaciones",
    label: "Observaciones",
    getValue: (item) => item.notes || "",
  },
];

function compareSortValues(a, b, direction) {
  const isEmpty = (v) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
  const aEmpty = isEmpty(a);
  const bEmpty = isEmpty(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let cmp = 0;
  if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b), "es", { sensitivity: "base", numeric: true });
  }
  return direction === "asc" ? cmp : -cmp;
}

function SortableTh({ column, sortColumn, sortDirection, onSort }) {
  const active = sortColumn === column.id;
  const ariaSort = active ? (sortDirection === "asc" ? "ascending" : "descending") : "none";
  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className={`inv-th-sort${active ? ` inv-th-sort--${sortDirection}` : ""}`}
        onClick={() => onSort(column.id)}
      >
        <span>{column.label}</span>
        <span className="inv-th-sort__icon" aria-hidden="true">
          {active ? (sortDirection === "desc" ? "▼" : "▲") : "↕"}
        </span>
      </button>
    </th>
  );
}

function TableSkeleton({ rows = 8, archived = false }) {
  return (
    <tbody>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="inv-skeleton-row">
          <td><span className="inv-skeleton inv-skeleton--md" /></td>
          <td><span className="inv-skeleton inv-skeleton--lg" /></td>
          <td><span className="inv-skeleton inv-skeleton--xs" /></td>
          <td><span className="inv-skeleton inv-skeleton--sm" /></td>
          <td><span className="inv-skeleton inv-skeleton--md" /></td>
          <td><span className="inv-skeleton inv-skeleton--sm" /></td>
          <td><span className="inv-skeleton inv-skeleton--xs" /></td>
          <td><span className="inv-skeleton inv-skeleton--sm" /></td>
          <td><span className="inv-skeleton inv-skeleton--sm" /></td>
          {archived && <td><span className="inv-skeleton inv-skeleton--sm" /></td>}
          <td><span className="inv-skeleton inv-skeleton--md" /></td>
          <td />
        </tr>
      ))}
    </tbody>
  );
}

export default function InventarioAdmin() {
  const { user, authChecked, signOut, navigate } = useInventarioPage();
  const identifierInputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [deviceColors, setDeviceColors] = useState([]);
  const [deviceBrands, setDeviceBrands] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [catalogMenuOpen, setCatalogMenuOpen] = useState(false);
  const [editingOriginalStatus, setEditingOriginalStatus] = useState(null);
  const [equipoForm, setEquipoForm] = useState(EMPTY_EQUIPO_FORM);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [colorForm, setColorForm] = useState(EMPTY_COLOR_FORM);
  const [brandForm, setBrandForm] = useState(EMPTY_BRAND_FORM);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [creatingEquipo, setCreatingEquipo] = useState(false);
  const [editingEquipoId, setEditingEquipoId] = useState(null);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [editingColorId, setEditingColorId] = useState(null);
  const [editingBrandId, setEditingBrandId] = useState(null);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [creatingColor, setCreatingColor] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [deletingSupplierId, setDeletingSupplierId] = useState(null);
  const [deletingColorId, setDeletingColorId] = useState(null);
  const [deletingBrandId, setDeletingBrandId] = useState(null);
  const [catalogDeleteTarget, setCatalogDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [searchDraft, setSearchDraft] = useState("");
  const [listScope, setListScope] = useState("active");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [equipoModalOpen, setEquipoModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [groupedSummary, setGroupedSummary] = useState([]);
  const [historyItem, setHistoryItem] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [retakingId, setRetakingId] = useState(null);
  const [retakeTarget, setRetakeTarget] = useState(null);
  const [retakePrice, setRetakePrice] = useState("");
  const [retakePaymentMethod, setRetakePaymentMethod] = useState("efectivo");
  const [sortColumn, setSortColumn] = useState("fecha_ingreso");
  const [sortDirection, setSortDirection] = useState("desc");

  const viewingArchived = listScope === "archived";

  const switchListScope = (scope) => {
    setListScope(scope);
    if (scope === "archived") setViewMode("list");
  };

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

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

  const fetchDeviceBrands = useCallback(async () => {
    try {
      const data = await api.getDeviceBrands();
      setDeviceBrands(data || []);
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [showToast]);

  const inventoryCacheKey = useMemo(
    () => ["inventory", { q: filters.q, status: filters.status, archived: listScope === "archived" }],
    [filters.q, filters.status, listScope],
  );

  const {
    data: cachedItems,
    loading: listLoading,
    refreshing: listRefreshing,
    refetch: refetchItems,
    setData: setCachedItems,
  } = useCachedQuery(
    inventoryCacheKey,
    () => api.getInventory({
      q: filters.q || undefined,
      status: filters.status || undefined,
      archived: listScope === "archived",
    }),
    { enabled: Boolean(user) },
  );

  useEffect(() => {
    setItems(cachedItems || []);
  }, [cachedItems]);

  const visibleSortColumns = useMemo(
    () => INVENTORY_SORT_COLUMNS.filter((column) => !column.archivedOnly || viewingArchived),
    [viewingArchived],
  );

  const sortedItems = useMemo(() => {
    const column = visibleSortColumns.find((c) => c.id === sortColumn) || visibleSortColumns.find((c) => c.id === "fecha_ingreso") || visibleSortColumns[0];
    const rows = [...items];
    rows.sort((a, b) => compareSortValues(column.getValue(a), column.getValue(b), sortDirection));
    return rows;
  }, [items, sortColumn, sortDirection, visibleSortColumns]);

  const handleSort = useCallback((columnId) => {
    if (sortColumn === columnId) {
      setSortDirection((dir) => (dir === "desc" ? "asc" : "desc"));
      return;
    }
    setSortColumn(columnId);
    setSortDirection("desc");
  }, [sortColumn]);

  const fetchItems = useCallback(async () => {
    try {
      await refetchItems();
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [refetchItems, showToast]);

  const bumpInventoryCaches = useCallback(() => {
    invalidateInventarioCache("inventory", "salesBootstrap", "dashboard");
  }, []);

  const fetchGroupedSummary = useCallback(async () => {
    try {
      const data = await api.getInventorySummaryByModel({
        status: filters.status || undefined,
      });
      setGroupedSummary(data || []);
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [filters.status, showToast]);

  useEffect(() => {
    if (user) {
      if (viewMode === "grouped") fetchGroupedSummary();
    }
  }, [user, viewMode, fetchGroupedSummary]);

  useEffect(() => {
    if (!user) return;
    if ((itemModalOpen || equipoModalOpen || brandModalOpen) && deviceBrands.length === 0) fetchDeviceBrands();
    if ((itemModalOpen || equipoModalOpen) && catalogProducts.length === 0) {
      fetchCatalogProducts();
    }
    if (itemModalOpen && suppliers.length === 0) fetchSuppliers();
    if ((itemModalOpen || colorModalOpen) && deviceColors.length === 0) fetchDeviceColors();
    if (supplierModalOpen && suppliers.length === 0) fetchSuppliers();
  }, [
    user,
    itemModalOpen,
    equipoModalOpen,
    supplierModalOpen,
    colorModalOpen,
    brandModalOpen,
    catalogProducts.length,
    suppliers.length,
    deviceColors.length,
    deviceBrands.length,
    fetchCatalogProducts,
    fetchSuppliers,
    fetchDeviceColors,
    fetchDeviceBrands,
  ]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!deleteTarget && !catalogDeleteTarget && !itemModalOpen && !equipoModalOpen && !supplierModalOpen && !colorModalOpen && !brandModalOpen) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (catalogDeleteTarget && !deletingColorId && !deletingSupplierId && !deletingBrandId) {
        setCatalogDeleteTarget(null);
        return;
      }
      if (deleteTarget && !deletingId) {
        setDeleteTarget(null);
        return;
      }
      if (colorModalOpen && !creatingColor) {
        if (editingColorId) cancelColorEdit();
        else setColorModalOpen(false);
      } else if (brandModalOpen && !creatingBrand) {
        if (editingBrandId) cancelBrandEdit();
        else setBrandModalOpen(false);
      } else if (supplierModalOpen && !creatingSupplier) {
        if (editingSupplierId) cancelSupplierEdit();
        else setSupplierModalOpen(false);
      } else if (equipoModalOpen && !creatingEquipo) closeEquipoModal();
      else if (itemModalOpen && !submitting) closeItemModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget, catalogDeleteTarget, itemModalOpen, equipoModalOpen, supplierModalOpen, colorModalOpen, brandModalOpen, creatingEquipo, creatingSupplier, creatingColor, creatingBrand, submitting, deletingId, deletingColorId, deletingSupplierId, deletingBrandId, editingColorId, editingBrandId, editingSupplierId]);

  const defaultCatalogBrand = () => (
    deviceBrands.some((b) => b.name === "IPHONE") ? "IPHONE" : deviceBrands[0]?.name || ""
  );

  const buildItemNamePreview = (draft) => {
    const base = {
      brand: draft.catalog_brand,
      model: draft.catalog_model,
      storage: draft.catalog_storage,
    };
    if (!draft.catalog_brand && !draft.catalog_model && !draft.catalog_storage) {
      return draft.name || "";
    }
    return buildInventoryItemName(base, draft.color);
  };

  const openNewItemModal = () => {
    setEditingId(null);
    setEditingOriginalStatus(null);
    setForm({ ...EMPTY_FORM, catalog_brand: defaultCatalogBrand() });
    setItemModalOpen(true);
    requestAnimationFrame(() => identifierInputRef.current?.focus());
  };

  const closeItemModal = () => {
    if (submitting) return;
    setItemModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setEditingOriginalStatus(null);
  };

  const startEdit = (item) => {
    const product = item.inventory_product || catalogProducts.find((p) => p.id === item.inventory_product_id);
    setEditingId(item.id);
    setEditingOriginalStatus(item.status || "disponible");
    setForm({
      imei: item.imei || "",
      barcode: item.barcode || "",
      name: item.name || "",
      color: item.color || "",
      supplier: item.supplier || "",
      supplier_id: item.supplier_id || "",
      purchase_price: item.purchase_price || "",
      sale_price: item.sale_price || "",
      battery: item.battery ?? "",
      status: item.status || "disponible",
      notes: item.notes || "",
      inventory_product_id: item.inventory_product_id || "",
      ...productToItemCatalogFields(product),
      acquired_at: item.acquired_at ? item.acquired_at.slice(0, 10) : "",
    });
    setItemModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setEditingOriginalStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.catalog_brand.trim()) {
      showToast("Selecciona la marca del equipo", "error");
      return;
    }
    if (!form.catalog_model.trim()) {
      showToast("Indica el modelo del equipo", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        name: buildItemNamePreview(form) || form.name,
        battery: form.battery === "" ? null : Number(form.battery),
        supplier_id: form.supplier_id || undefined,
        acquired_at: form.acquired_at || undefined,
        catalog_brand: form.catalog_brand.trim() || undefined,
        catalog_model: form.catalog_model.trim() || undefined,
        catalog_storage: form.catalog_storage.trim() || undefined,
        inventory_product_id: form.inventory_product_id || undefined,
      };

      if (editingId) {
        const updated = await api.updateInventoryItem(editingId, payload);
        showToast("Equipo actualizado");
        bumpInventoryCaches();
        setCachedItems((prev) => (prev || []).map((item) => (item.id === editingId ? updated : item)));
      } else {
        const created = await api.createInventoryItem(payload);
        showToast("Equipo agregado al inventario");
        bumpInventoryCaches();
        setCachedItems((prev) => [created, ...(prev || [])]);
      }

      resetForm();
      setItemModalOpen(false);
      await fetchCatalogProducts();
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
    const defaultBrand = deviceBrands.some((b) => b.name === "IPHONE")
      ? "IPHONE"
      : deviceBrands[0]?.name || "";
    setEquipoForm({ ...EMPTY_EQUIPO_FORM, brand: defaultBrand });
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
    const preview = buildCatalogPreview(equipoForm);
    if (!equipoForm.brand.trim()) {
      showToast("Selecciona la marca del modelo", "error");
      return;
    }
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
      }
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setCreatingEquipo(false);
    }
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;
    setCreatingSupplier(true);
    try {
      const location = locationPayload({
        department_code: supplierForm.department_code,
        municipality_code: supplierForm.municipality_code,
        city: supplierForm.city,
      });
      const payload = {
        name: supplierForm.name.trim(),
        contact_name: supplierForm.contact_name.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
        email: supplierForm.email.trim() || undefined,
        department_code: location.department_code || undefined,
        municipality_code: location.municipality_code || undefined,
        city: location.city || undefined,
        address: supplierForm.address.trim() || undefined,
        notes: supplierForm.notes.trim() || undefined,
      };

      if (editingSupplierId) {
        const updated = await api.updateSupplier(editingSupplierId, payload);
        await fetchSuppliers();
        await fetchItems();
        setEditingSupplierId(null);
        setSupplierForm(EMPTY_SUPPLIER_FORM);
        showToast(`Proveedor "${updated.name}" actualizado`);
      } else {
        const created = await api.createSupplier(payload);
        await fetchSuppliers();
        setForm((s) => ({ ...s, supplier: created.name, supplier_id: created.id }));
        setSupplierForm(EMPTY_SUPPLIER_FORM);
        showToast(`Proveedor "${created.name}" creado`);
      }
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setCreatingSupplier(false);
    }
  };

  const startEditSupplier = (supplier) => {
    setEditingSupplierId(supplier.id);
    setSupplierForm(supplierToForm(supplier));
  };

  const cancelSupplierEdit = () => {
    setEditingSupplierId(null);
    setSupplierForm(EMPTY_SUPPLIER_FORM);
  };

  const handleSaveColor = async (e) => {
    e.preventDefault();
    if (!colorForm.name.trim()) return;
    setCreatingColor(true);
    try {
      if (editingColorId) {
        const updated = await api.updateDeviceColor(editingColorId, colorForm.name.trim());
        await fetchDeviceColors();
        await fetchCatalogProducts();
        await fetchItems();
        setEditingColorId(null);
        setColorForm(EMPTY_COLOR_FORM);
        showToast(`Color "${updated.name}" actualizado`);
      } else {
        const created = await api.createDeviceColor(colorForm.name.trim());
        await fetchDeviceColors();
        setColorForm(EMPTY_COLOR_FORM);
        showToast(`Color "${created.name}" agregado`);
      }
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setCreatingColor(false);
    }
  };

  const startEditColor = (color) => {
    setEditingColorId(color.id);
    setColorForm({ name: color.name || "" });
  };

  const cancelColorEdit = () => {
    setEditingColorId(null);
    setColorForm(EMPTY_COLOR_FORM);
  };

  const handleSaveBrand = async (e) => {
    e.preventDefault();
    if (!brandForm.name.trim()) return;
    setCreatingBrand(true);
    try {
      if (editingBrandId) {
        const updated = await api.updateDeviceBrand(editingBrandId, brandForm.name.trim());
        await fetchDeviceBrands();
        await fetchCatalogProducts();
        setEditingBrandId(null);
        setBrandForm(EMPTY_BRAND_FORM);
        showToast(`Marca "${updated.name}" actualizada`);
      } else {
        const created = await api.createDeviceBrand(brandForm.name.trim());
        await fetchDeviceBrands();
        setBrandForm(EMPTY_BRAND_FORM);
        showToast(`Marca "${created.name}" agregada`);
      }
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setCreatingBrand(false);
    }
  };

  const startEditBrand = (brand) => {
    setEditingBrandId(brand.id);
    setBrandForm({ name: brand.name || "" });
  };

  const cancelBrandEdit = () => {
    setEditingBrandId(null);
    setBrandForm(EMPTY_BRAND_FORM);
  };

  const removeColor = (id, name) => {
    setCatalogDeleteTarget({ kind: "color", id, name });
  };

  const removeSupplier = (id, name) => {
    setCatalogDeleteTarget({ kind: "supplier", id, name });
  };

  const removeBrand = (id, name) => {
    setCatalogDeleteTarget({ kind: "brand", id, name });
  };

  const confirmCatalogDelete = async () => {
    if (!catalogDeleteTarget) return;
    const { kind, id, name } = catalogDeleteTarget;

    if (kind === "color") {
      setDeletingColorId(id);
      try {
        await api.deleteDeviceColor(id);
        await fetchDeviceColors();
        showToast(`Color "${name}" eliminado`);
        setCatalogDeleteTarget(null);
      } catch (err) {
        showToast(err.message || String(err), "error");
      } finally {
        setDeletingColorId(null);
      }
      return;
    }

    if (kind === "brand") {
      setDeletingBrandId(id);
      try {
        await api.deleteDeviceBrand(id);
        await fetchDeviceBrands();
        showToast(`Marca "${name}" eliminada`);
        setCatalogDeleteTarget(null);
      } catch (err) {
        showToast(err.message || String(err), "error");
      } finally {
        setDeletingBrandId(null);
      }
      return;
    }

    setDeletingSupplierId(id);
    try {
      await api.deleteSupplier(id);
      await fetchSuppliers();
      showToast(`Proveedor "${name}" eliminado`);
      setCatalogDeleteTarget(null);
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setDeletingSupplierId(null);
    }
  };

  const catalogDeleteLoading = catalogDeleteTarget?.kind === "color"
    ? deletingColorId === catalogDeleteTarget?.id
    : catalogDeleteTarget?.kind === "brand"
      ? deletingBrandId === catalogDeleteTarget?.id
      : catalogDeleteTarget?.kind === "supplier"
        ? deletingSupplierId === catalogDeleteTarget?.id
        : false;

  const pickEquipoFromCatalog = (productId) => {
    if (!productId) {
      setForm((s) => ({
        ...s,
        inventory_product_id: "",
        name: buildItemNamePreview({ ...s, inventory_product_id: "" }),
      }));
      return;
    }
    const product = catalogProducts.find((p) => p.id === productId);
    if (!product) return;
    setForm((s) => ({
      ...s,
      inventory_product_id: product.id,
      ...productToItemCatalogFields(product),
      name: buildInventoryItemName(product, s.color),
      sale_price: product.reference_price || s.sale_price,
    }));
  };

  const updateItemCatalogField = (field, value) => {
    setForm((s) => {
      const next = { ...s, [field]: value, inventory_product_id: "" };
      next.name = buildItemNamePreview(next);
      return next;
    });
  };

  const updateItemColor = (color) => {
    setForm((s) => {
      const next = { ...s, color };
      next.name = buildItemNamePreview(next);
      return next;
    });
  };

  const itemNamePreview = buildItemNamePreview(form);
  const equipoPreview = buildCatalogPreview(equipoForm);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    try {
      await api.deleteInventoryItem(id);
      showToast(`"${deleteTarget.name}" archivado`);
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

  const openRetakeModal = (item) => {
    setRetakeTarget(item);
    setRetakePrice("");
    setRetakePaymentMethod("efectivo");
  };

  const closeRetakeModal = () => {
    if (retakingId) return;
    setRetakeTarget(null);
    setRetakePrice("");
    setRetakePaymentMethod("efectivo");
  };

  const confirmRetake = async (e) => {
    e.preventDefault();
    if (!retakeTarget) return;

    const latestSale = retakeTarget.latest_sale;
    if (latestSale?.amount_due > 0) {
      showToast("Esta venta tiene saldo pendiente. Registra los abonos antes de retomar.", "error");
      return;
    }

    const price = parseCop(retakePrice);
    if (price <= 0) {
      showToast("Ingresa el valor de retoma", "error");
      return;
    }

    setRetakingId(retakeTarget.id);
    try {
      await api.retakeInventoryItem(retakeTarget.id, {
        retake_price: price,
        retake_payment_method: retakePaymentMethod,
      });
      showToast(`"${retakeTarget.name}" marcado como retomado`);
      setRetakeTarget(null);
      setRetakePrice("");
      fetchItems();
      if (viewMode === "grouped") fetchGroupedSummary();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setRetakingId(null);
    }
  };

  const handleRetake = async (item) => {
    if (item.status === "vendido") {
      openRetakeModal(item);
      return;
    }

    setRetakingId(item.id);
    try {
      await api.retakeInventoryItem(item.id);
      showToast(`"${item.name}" reingresado al inventario`);
      fetchItems();
      if (viewMode === "grouped") fetchGroupedSummary();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setRetakingId(null);
    }
  };

  const openGroupedDetail = (group) => {
    setViewMode("list");
    setSearchDraft(group.name);
    setFilters((prev) => ({ ...prev, q: group.name }));
  };

  const sellItem = (item) => {
    navigate(`/admin/inventario/ventas?item=${item.id}`);
  };

  const showSensitive = canViewSensitiveInventoryFields(user);

  const updateItemIdentifier = (value) => {
    setForm((s) => ({
      ...s,
      ...applyInventoryIdentifierInput(value, { allowImei: showSensitive }),
    }));
  };

  const itemIdentifierValue = formatInventoryIdentifier(form.imei, form.barcode, { showImei: showSensitive });

  const showHistory = async (item) => {
    setHistoryItem(item);
    setHistoryLoading(true);
    try {
      const detail = await api.getInventoryItem(item.id);
      setHistoryItem(detail);
    } catch (e) {
      setHistoryItem(null);
      showToast(e.message, "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchDraft("");
    setFilters({ q: "", status: "" });
  };

  if (!isApiConfigured) {
    return (
      <div className="inv-dash inv-dash--centered">
        <p className="inv-dash__muted">Inventario — API no configurada</p>
      </div>
    );
  }

  if (!authChecked || !user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
        <p className="inv-dash__muted">Verificando sesión…</p>
      </div>
    );
  }

  if (isServiceTechnician(user)) {
    return <Navigate to="/admin/inventario/servicio-tecnico" replace />;
  }

  if (isAccountant(user)) {
    return <Navigate to="/admin/inventario/dashboard" replace />;
  }

  if (!canAccessInventory(user)) {
    if (canAccessContent(user)) {
      return <Navigate to="/admin" replace />;
    }
    return (
      <div className="inv-dash inv-dash--centered">
        <p className="inv-dash__muted">Tu cuenta no tiene acceso al inventario.</p>
        <button type="button" className="inv-btn inv-btn--outline" onClick={signOut}>Cerrar sesión</button>
      </div>
    );
  }

  const countByStatus = (status) => items.filter((i) => i.status === status).length;
  const hasActiveFilters = Boolean(filters.q || filters.status);
  const filterableStatuses = Object.entries(STATUS_LABELS).filter(([value]) => value !== "archived");
  const isInitialLoad = listLoading && items.length === 0;
  const isFilteredEmpty = !listLoading && items.length === 0 && hasActiveFilters;
  const catalogProductOptions = useMemo(
    () => catalogProductSelectOptions(catalogProducts),
    [catalogProducts],
  );
  const brandOptions = useMemo(
    () => brandSelectOptions(deviceBrands),
    [deviceBrands],
  );
  const catalogModelOptions = useMemo(
    () => catalogModelSelectOptions(iphoneModels, catalogProducts, form.catalog_brand),
    [catalogProducts, form.catalog_brand],
  );
  const equipoCatalogModelOptions = useMemo(
    () => catalogModelSelectOptions(iphoneModels, catalogProducts, equipoForm.brand),
    [catalogProducts, equipoForm.brand],
  );
  const supplierOptions = useMemo(
    () => supplierSelectOptions(suppliers),
    [suppliers],
  );

  return (
    <div className="inv-dash">
      <InventarioTopbar current="inventario" user={user} onSignOut={signOut} />

      <main className="inv-main inv-main--sheet">
        <MobileCollapsible summary="Resumen del inventario" className="inv-mobile-fold--inline">
        <div className="inv-stats inv-stats--5" aria-live="polite">
          {viewingArchived ? (
            <article className="inv-stat inv-stat--slate">
              <span className="inv-stat__label">Archivados</span>
              <strong className="inv-stat__value">{listLoading ? "…" : items.length}</strong>
            </article>
          ) : (
            <>
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
          <article className="inv-stat inv-stat--purple">
            <span className="inv-stat__label">Retomado</span>
            <strong className="inv-stat__value">{listLoading ? "…" : countByStatus("retomado")}</strong>
          </article>
            </>
          )}
        </div>
        </MobileCollapsible>

        <section className={`inv-panel inv-panel--sheet ${listLoading && items.length > 0 ? "is-refreshing" : ""}`}>
          <div className="inv-sheet-toolbar">
            <MobileCollapsible summary="Buscar y filtrar" className="inv-mobile-fold--toolbar">
            <div className="inv-filters inv-filters--sheet">
              <form
                className="inv-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFilters((prev) => ({ ...prev, q: searchDraft }));
                }}
              >
                <InvIcon name="search" className="inv-search__icon" />
                <input
                  className="inv-search__input"
                  placeholder="Buscar código barras, IMEI, equipo, proveedor…"
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
                {filterableStatuses.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {hasActiveFilters && (
                <button type="button" className="inv-btn inv-btn--ghost inv-btn--compact" onClick={clearFilters}>
                  <InvIcon name="x-circle" />
                  Limpiar
                </button>
              )}
            </div>
            </MobileCollapsible>
            <div className="inv-sheet-actions">
              <button
                type="button"
                className={`inv-btn inv-btn--ghost${listScope === "active" ? " is-active" : ""}`}
                onClick={() => switchListScope("active")}
              >
                <InvIcon name="folder" />
                Activos
              </button>
              <button
                type="button"
                className={`inv-btn inv-btn--ghost${listScope === "archived" ? " is-active" : ""}`}
                onClick={() => switchListScope("archived")}
              >
                <InvIcon name="archive" />
                Archivados
              </button>
              <button
                type="button"
                className={`inv-btn inv-btn--ghost${viewMode === "list" ? " is-active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                <InvIcon name="list" />
                Lista
              </button>
              {!viewingArchived && (
              <button
                type="button"
                className={`inv-btn inv-btn--ghost${viewMode === "grouped" ? " is-active" : ""}`}
                onClick={() => { setViewMode("grouped"); fetchGroupedSummary(); }}
              >
                <InvIcon name="grid" />
                Por modelo
              </button>
              )}
              {canManageInventory(user) && !viewingArchived && (
                <>
                  <div className="inv-catalog-menu" style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="inv-btn inv-btn--outline"
                      onClick={() => setCatalogMenuOpen((open) => !open)}
                      aria-expanded={catalogMenuOpen}
                    >
                      <InvIcon name="layers" />
                      Catálogos
                      <InvIcon name="chevron-down" />
                    </button>
                    {catalogMenuOpen && (
                      <div
                        className="inv-panel"
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "calc(100% + 0.35rem)",
                          zIndex: 20,
                          minWidth: "11rem",
                          padding: "0.35rem",
                          display: "grid",
                          gap: "0.25rem",
                          boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                        }}
                        role="menu"
                      >
                        <button
                          type="button"
                          className="inv-btn inv-btn--ghost"
                          style={{ justifyContent: "flex-start" }}
                          onClick={() => {
                            setColorForm(EMPTY_COLOR_FORM);
                            setEditingColorId(null);
                            setColorModalOpen(true);
                            setCatalogMenuOpen(false);
                          }}
                        >
                          <InvIcon name="palette" />
                          Colores
                        </button>
                        <button
                          type="button"
                          className="inv-btn inv-btn--ghost"
                          style={{ justifyContent: "flex-start" }}
                          onClick={() => {
                            setBrandForm(EMPTY_BRAND_FORM);
                            setEditingBrandId(null);
                            setBrandModalOpen(true);
                            setCatalogMenuOpen(false);
                          }}
                        >
                          <InvIcon name="tag" />
                          Marcas
                        </button>
                        <button
                          type="button"
                          className="inv-btn inv-btn--ghost"
                          style={{ justifyContent: "flex-start" }}
                          onClick={() => {
                            setSupplierForm(EMPTY_SUPPLIER_FORM);
                            setEditingSupplierId(null);
                            setSupplierModalOpen(true);
                            setCatalogMenuOpen(false);
                          }}
                        >
                          <InvIcon name="truck" />
                          Proveedores
                        </button>
                        <button
                          type="button"
                          className="inv-btn inv-btn--ghost"
                          style={{ justifyContent: "flex-start" }}
                          onClick={() => {
                            openEquipoModal();
                            setCatalogMenuOpen(false);
                          }}
                        >
                          <InvIcon name="smartphone" />
                          Modelos
                        </button>
                      </div>
                    )}
                  </div>
                  <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openNewItemModal}>
                    <InvIcon name="plus" />
                    Agregar equipo
                  </button>
                </>
              )}
              <button
                type="button"
                className="inv-btn inv-btn--icon"
                onClick={fetchItems}
                disabled={listLoading}
                title="Actualizar"
                aria-label="Actualizar"
              >
                <InvIcon name="refresh" className="" spin={listLoading} />
              </button>
            </div>
          </div>

          <div className="inv-table-wrap inv-table-wrap--sheet">
            {viewMode === "grouped" && !viewingArchived ? (
              <div className="inv-grouped-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem", padding: "1rem" }}>
                {groupedSummary.length === 0 ? (
                  <p className="inv-sheet-empty">Sin datos agrupados.</p>
                ) : (
                  groupedSummary.map((group) => (
                    <article
                      key={group.inventory_product_id || group.name}
                      className="inv-panel"
                      style={{ borderLeft: `4px solid ${group.color}`, padding: "1rem", cursor: "pointer" }}
                      onClick={() => openGroupedDetail(group)}
                      title="Clic para ver unidades"
                    >
                      <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>{group.name}</h3>
                      <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>{group.total} uds.</p>
                      <ul style={{ margin: "0.75rem 0 0", padding: 0, listStyle: "none", fontSize: "0.85rem" }}>
                        {Object.entries(group.by_status || {}).filter(([, n]) => n > 0).map(([status, count]) => (
                          <li key={status}>{STATUS_LABELS[status] || status}: {count}</li>
                        ))}
                      </ul>
                    </article>
                  ))
                )}
              </div>
            ) : (
            <table className="inv-table inv-table--sheet">
              <thead>
                <tr>
                  {visibleSortColumns.map((column) => (
                    <SortableTh
                      key={column.id}
                      column={column}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  ))}
                  <th />
                </tr>
              </thead>
              {isInitialLoad ? (
                <TableSkeleton archived={viewingArchived} />
              ) : items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={viewingArchived ? 12 : 11} className="inv-sheet-empty">
                      <p>
                        {viewingArchived
                          ? (isFilteredEmpty ? "Sin archivados para los filtros aplicados." : "No hay equipos archivados.")
                          : (isFilteredEmpty ? "Sin resultados para los filtros aplicados." : "No hay equipos registrados.")}
                      </p>
                      {!isFilteredEmpty && !viewingArchived && (
                        <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openNewItemModal}>
                          <InvIcon name="plus" />
                          Agregar primer equipo
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {sortedItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`inv-sheet-row ${viewingArchived ? "" : "is-clickable"} ${editingId === item.id ? "is-editing" : ""} ${item.color ? "has-color" : ""} ${item.is_archived ? "is-archived" : ""}`}
                      style={item.color ? { "--inv-row-accent": getDeviceColorHex(item.color) } : undefined}
                      onClick={viewingArchived ? undefined : () => startEdit(item)}
                      title={viewingArchived ? undefined : "Clic para editar"}
                    >
                      <td data-label="Cód. barras / IMEI">
                        <span className="inv-sheet-imei">
                          {formatInventoryIdentifier(item.imei, item.barcode, { showImei: showSensitive }) || "—"}
                        </span>
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
                      <td data-label="Fecha ingreso">
                        <span className="inv-sheet-muted">{formatAcquiredAt(item)}</span>
                      </td>
                      <td data-label="Batería">
                        <span className={`inv-sheet-battery ${item.battery != null && item.battery < 85 ? "is-low" : ""}`}>
                          {item.battery != null && item.battery !== "" ? `${item.battery}%` : ""}
                        </span>
                      </td>
                      <td data-label="Estado">
                        <span className={`inv-badge inv-badge--${item.is_archived ? "archived" : item.status}`}>
                          {item.is_archived ? "ARCHIVADO" : (STATUS_LABELS[item.status] || item.status)}
                        </span>
                      </td>
                      <td data-label="Método venta">
                        {(() => {
                          const method = inventorySalePaymentMethod(item);
                          return method ? (
                            <PaymentMethodBadge method={method} />
                          ) : (
                            <span className="inv-sheet-muted">—</span>
                          );
                        })()}
                      </td>
                      {viewingArchived && (
                        <td data-label="Archivado el">
                          <span className="inv-sheet-muted">{formatArchivedAt(item.deleted_at)}</span>
                        </td>
                      )}
                      <td data-label="Observaciones">
                        <span className="inv-sheet-notes">{item.notes || ""}</span>
                      </td>
                      <td data-label="Acciones" onClick={(e) => e.stopPropagation()}>
                        <div className="inv-row-actions">
                          <button type="button" className="inv-icon-btn" title="Historial" onClick={() => showHistory(item)}>
                            <InvIcon name="history" className="" />
                          </button>
                          {!viewingArchived && canManageInventory(user) && (
                            <button type="button" className="inv-icon-btn" title="Editar" onClick={() => startEdit(item)}>
                              <InvIcon name="pencil" className="" />
                            </button>
                          )}
                          {!viewingArchived && (item.status === "disponible" || item.status === "separado") && canManageSales(user) && (
                            <button
                              type="button"
                              className="inv-icon-btn"
                              title="Vender"
                              onClick={() => sellItem(item)}
                            >
                              <InvIcon name="ventas" className="" />
                            </button>
                          )}
                          {!viewingArchived && item.status === "vendido" && canManageInventory(user) && (
                            <button
                              type="button"
                              className="inv-icon-btn"
                              title="Retomar"
                              disabled={retakingId === item.id}
                              onClick={() => handleRetake(item)}
                            >
                              <InvIcon name="rotate-ccw" className="" />
                            </button>
                          )}
                          {!viewingArchived && item.status === "retomado" && canManageInventory(user) && (
                            <button
                              type="button"
                              className="inv-icon-btn"
                              title="Reingresar"
                              disabled={retakingId === item.id}
                              onClick={() => handleRetake(item)}
                            >
                              <InvIcon name="check-circle" className="" />
                            </button>
                          )}
                          {!viewingArchived && canManageInventory(user) && item.status !== "vendido" && item.status !== "retomado" && (
                          <button
                            type="button"
                            className="inv-icon-btn inv-icon-btn--danger"
                            title="Archivar"
                            disabled={deletingId === item.id}
                            onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                          >
                            {deletingId === item.id ? (
                              <span className="inv-loader inv-loader--sm" />
                            ) : (
                              <InvIcon name="trash" className="" />
                            )}
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
            )}
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
            <p className="inv-modal__text">
              {editingId
                ? "Modifica los datos de la unidad. El modelo se reutiliza en el catálogo para futuros ingresos."
                : "Registra la unidad con marca, modelo y almacenamiento. Si el modelo no existe, se guarda automáticamente en el catálogo."}
            </p>
            <form onSubmit={handleSubmit} className="inv-modal-form inv-modal-form--grid">
              <Field label={showSensitive ? "Código de barras / IMEI" : "Código de barras"} className="inv-field--span-all">
                <input
                  ref={identifierInputRef}
                  className="inv-field__input inv-field__input--mono"
                  placeholder={showSensitive ? "Escanear código EAN/UPC o IMEI (15 dígitos)…" : "Escanear o escribir código EAN/UPC…"}
                  value={itemIdentifierValue}
                  onChange={(e) => updateItemIdentifier(e.target.value)}
                  autoComplete="off"
                />
              </Field>

              {catalogProducts.length > 0 && (
                <Field label="Modelo guardado (opcional)" className="inv-field--span-all">
                  <SearchSelect
                    value={form.inventory_product_id}
                    onChange={pickEquipoFromCatalog}
                    options={catalogProductOptions}
                    placeholder="Buscar en catálogo…"
                    searchPlaceholder="Marca, modelo, almacenamiento…"
                    clearLabel="Definir modelo manualmente"
                  />
                </Field>
              )}

              <Field label="Marca *">
                <SearchSelect
                  value={form.catalog_brand}
                  onChange={(brand) => updateItemCatalogField("catalog_brand", brand)}
                  options={brandOptions}
                  placeholder={deviceBrands.length === 0 ? "Crea marcas con + Marca" : "Seleccionar marca…"}
                  searchPlaceholder="Buscar marca…"
                  allowClear={false}
                  clearLabel=""
                />
              </Field>

              <Field label="Modelo *">
                <SearchSelect
                  value={form.catalog_model}
                  onChange={(model) => updateItemCatalogField("catalog_model", model)}
                  options={catalogModelOptions}
                  placeholder={form.catalog_brand ? "Seleccionar o buscar modelo…" : "Selecciona la marca primero…"}
                  searchPlaceholder="Ej. 15 PRO MAX…"
                  allowClear={false}
                  clearLabel=""
                  creatable
                />
              </Field>

              <Field label="Almacenamiento">
                <SearchSelect
                  value={form.catalog_storage}
                  onChange={(storage) => updateItemCatalogField("catalog_storage", storage)}
                  options={IPHONE_STORAGE_OPTIONS}
                  placeholder="Seleccionar almacenamiento…"
                  searchPlaceholder="Ej. 256GB…"
                  creatable
                />
              </Field>

              <Field label="Color">
                <ColorSelect
                  value={form.color}
                  onChange={updateItemColor}
                  colors={deviceColors}
                  placeholder="Color de esta unidad"
                />
              </Field>

              <p className="inv-product-preview inv-field--span-all">
                Nombre en inventario: <strong>{itemNamePreview || "—"}</strong>
              </p>

              <Field label="Proveedor">
                <SearchSelect
                  value={form.supplier_id || ""}
                  onChange={(id) => {
                    const supplier = suppliers.find((s) => s.id === id);
                    setForm((s) => ({
                      ...s,
                      supplier_id: supplier?.id || "",
                      supplier: supplier?.name || "",
                    }));
                  }}
                  options={supplierOptions}
                  placeholder={suppliers.length === 0 ? "Crea proveedores con + Proveedor" : "Buscar proveedor…"}
                  searchPlaceholder="Nombre, teléfono, ciudad…"
                  clearLabel="Sin proveedor"
                />
              </Field>

              {showSensitive && (
              <Field label="Precio compra">
                <CurrencyInput
                  value={form.purchase_price}
                  onChange={(purchase_price) => setForm((s) => ({ ...s, purchase_price }))}
                  placeholder="$ 2.500.000"
                />
              </Field>
              )}

              <Field label="Precio venta">
                <CurrencyInput
                  value={form.sale_price}
                  onChange={(sale_price) => setForm((s) => ({ ...s, sale_price }))}
                  placeholder="$ 1.300.000"
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

              <Field label="Fecha ingreso">
                <input
                  className="inv-field__input"
                  type="date"
                  value={form.acquired_at}
                  onChange={(e) => setForm((s) => ({ ...s, acquired_at: e.target.value }))}
                />
              </Field>

              <Field label="Estado">
                {editableInventoryStatuses(form.status) ? (
                  <select
                    className="inv-field__input"
                    value={form.status}
                    onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                  >
                    {Object.entries(editableInventoryStatuses(form.status)).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                ) : (
                  <div className="inv-field__input" style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--inv-surface-muted, #f8fafc)" }}>
                    <span className={`inv-badge inv-badge--${form.status}`}>
                      {STATUS_LABELS[form.status] || form.status}
                    </span>
                    <span className="inv-dash__muted" style={{ fontSize: "0.85rem" }}>
                      {form.status === "vendido" || form.status === "retomado"
                        ? "Use Retomar / Reingresar en la tabla."
                        : form.status === "servicio_tecnico"
                          ? "Se libera al cerrar el ticket de ST."
                          : "No editable manualmente."}
                    </span>
                  </div>
                )}
              </Field>

              {form.status === "separado" && (
                <div className="inv-field--span-all inv-separado-alert" role="status">
                  <span className="inv-badge inv-badge--separado">APARTADO</span>
                  {cachedItems?.find((i) => i.id === editingId)?.active_reservation ? (
                    <span>
                      Apartado activo · Abonado {formatPrice(cachedItems.find((i) => i.id === editingId).active_reservation.amount_paid)}
                      {" · "}Pendiente {formatPrice(cachedItems.find((i) => i.id === editingId).active_reservation.amount_due)}
                      {" · "}
                      <button
                        type="button"
                        className="inv-btn inv-btn--compact inv-btn--ghost"
                        onClick={() => sellItem(cachedItems.find((i) => i.id === editingId))}
                      >
                        Gestionar en Ventas
                      </button>
                    </span>
                  ) : (
                    <span>
                      Este equipo está apartado. Usa Ventas para abonar o completar la venta.
                    </span>
                  )}
                </div>
              )}

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
                {canManageInventory(user) && (
                  <button
                    type="button"
                    className="inv-btn inv-btn--ghost"
                    onClick={() => { closeItemModal(); openEquipoModal(); }}
                    disabled={submitting}
                  >
                    Administrar catálogo de modelos
                  </button>
                )}
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
            <h3 id="inv-color-title" className="inv-modal__title">
              {editingColorId ? "Editar color" : "Colores disponibles"}
            </h3>
            <p className="inv-modal__text">
              {editingColorId
                ? "Al renombrar un color se actualiza también en los equipos que lo usen."
                : "Administra los colores que aparecen al registrar equipos en el inventario."}
            </p>
            <form onSubmit={handleSaveColor} className="inv-modal-form">
              <Field label={editingColorId ? "Color" : "Nuevo color"}>
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
              <div className="inv-modal__actions">
                {editingColorId && (
                  <button type="button" className="inv-btn inv-btn--outline" onClick={cancelColorEdit} disabled={creatingColor}>
                    Cancelar edición
                  </button>
                )}
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={creatingColor}>
                  {creatingColor ? "Guardando…" : editingColorId ? "Actualizar color" : "Agregar color"}
                </button>
              </div>
            </form>
            {deviceColors.length > 0 && (
              <div className="inv-supplier-list">
                <p className="inv-supplier-list__title">Catálogo ({deviceColors.length}) — clic para editar</p>
                <ul className="inv-supplier-list__items inv-supplier-list__items--tall">
                  {deviceColors.map((c) => (
                    <li
                      key={c.id}
                      className={`inv-supplier-list__item inv-supplier-list__item--clickable ${editingColorId === c.id ? "is-selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="inv-supplier-list__pick"
                        onClick={() => startEditColor(c)}
                        disabled={creatingColor}
                      >
                        <span className="inv-supplier-list__name">
                          <ColorSwatch name={c.name} size={14} />
                          {getCanonicalColorName(c.name)}
                        </span>
                      </button>
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
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => { cancelColorEdit(); setColorModalOpen(false); }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {brandModalOpen && (
        <div className="inv-modal-overlay" role="presentation" onClick={() => !creatingBrand && setBrandModalOpen(false)}>
          <div
            className="inv-modal inv-modal--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inv-brand-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="inv-brand-title" className="inv-modal__title">
              {editingBrandId ? "Editar marca" : "Marcas de equipo"}
            </h3>
            <p className="inv-modal__text">
              {editingBrandId
                ? "Al renombrar una marca se actualiza también en los modelos del catálogo que la usen."
                : "Administra las marcas disponibles al crear modelos en el catálogo."}
            </p>
            <form onSubmit={handleSaveBrand} className="inv-modal-form">
              <Field label={editingBrandId ? "Marca" : "Nueva marca"}>
                <input
                  className="inv-field__input"
                  placeholder="IPHONE"
                  value={brandForm.name}
                  onChange={(e) => setBrandForm({ name: e.target.value.toUpperCase() })}
                  required
                  autoFocus
                  autoComplete="off"
                />
              </Field>
              <div className="inv-modal__actions">
                {editingBrandId && (
                  <button type="button" className="inv-btn inv-btn--outline" onClick={cancelBrandEdit} disabled={creatingBrand}>
                    Cancelar edición
                  </button>
                )}
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={creatingBrand}>
                  {creatingBrand ? "Guardando…" : editingBrandId ? "Actualizar marca" : "Agregar marca"}
                </button>
              </div>
            </form>
            {deviceBrands.length > 0 && (
              <div className="inv-supplier-list">
                <p className="inv-supplier-list__title">Catálogo ({deviceBrands.length}) — clic para editar</p>
                <ul className="inv-supplier-list__items inv-supplier-list__items--tall">
                  {deviceBrands.map((b) => (
                    <li
                      key={b.id}
                      className={`inv-supplier-list__item inv-supplier-list__item--clickable ${editingBrandId === b.id ? "is-selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="inv-supplier-list__pick"
                        onClick={() => startEditBrand(b)}
                        disabled={creatingBrand}
                      >
                        {b.name}
                      </button>
                      <button
                        type="button"
                        className="inv-supplier-list__remove"
                        onClick={() => removeBrand(b.id, b.name)}
                        disabled={creatingBrand || deletingBrandId === b.id}
                        aria-label={`Eliminar ${b.name}`}
                      >
                        {deletingBrandId === b.id ? "…" : "×"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="inv-modal__actions inv-modal__actions--solo">
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => { cancelBrandEdit(); setBrandModalOpen(false); }}>
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
            <h3 id="inv-supplier-title" className="inv-modal__title">
              {editingSupplierId ? "Editar proveedor" : "Proveedores"}
            </h3>
            <p className="inv-modal__text">
              {editingSupplierId
                ? "Modifica los datos del proveedor. Si cambias el nombre, se actualiza en los equipos vinculados."
                : "Registra la información del proveedor para usarla al ingresar equipos al inventario."}
            </p>
            <form onSubmit={handleSaveSupplier} className="inv-modal-form inv-modal-form--grid">
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
              <DaneLocationFields
                departmentCode={supplierForm.department_code}
                municipalityCode={supplierForm.municipality_code}
                onDepartmentChange={(department_code) =>
                  setSupplierForm((s) => ({ ...s, department_code, municipality_code: "", city: "" }))
                }
                onMunicipalityChange={(municipality_code) =>
                  setSupplierForm((s) => ({
                    ...s,
                    municipality_code,
                    city: municipality_code ? municipalityLabel(municipality_code) : "",
                  }))
                }
                disabled={creatingSupplier}
              />
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
              <div className="inv-field--span-all inv-modal__actions">
                {editingSupplierId && (
                  <button type="button" className="inv-btn inv-btn--outline" onClick={cancelSupplierEdit} disabled={creatingSupplier}>
                    Cancelar edición
                  </button>
                )}
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={creatingSupplier}>
                  {creatingSupplier ? "Guardando…" : editingSupplierId ? "Actualizar proveedor" : "Agregar proveedor"}
                </button>
              </div>
            </form>

            {suppliers.length > 0 && (
              <div className="inv-supplier-list">
                <p className="inv-supplier-list__title">Registrados ({suppliers.length}) — clic para editar</p>
                <ul className="inv-supplier-list__items">
                  {suppliers.map((s) => (
                    <li
                      key={s.id}
                      className={`inv-supplier-list__item inv-supplier-list__item--clickable ${editingSupplierId === s.id ? "is-selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="inv-supplier-list__pick"
                        onClick={() => startEditSupplier(s)}
                        disabled={creatingSupplier}
                      >
                        <div className="inv-supplier-list__info">
                          <span className="inv-supplier-list__name">{s.name}</span>
                          {supplierSubtitle(s) && (
                            <span className="inv-supplier-list__meta">{supplierSubtitle(s)}</span>
                          )}
                        </div>
                      </button>
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
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => { cancelSupplierEdit(); setSupplierModalOpen(false); }}>
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
              {editingEquipoId ? "Editar modelo" : "Catálogo de modelos"}
            </h3>
            <p className="inv-modal__text">
              {editingEquipoId
                ? "Modifica los datos del modelo. El nombre se actualiza automáticamente."
                : "Los modelos nuevos se crean al agregar equipos. Aquí puedes revisar y editar los existentes."}
            </p>

            {editingEquipoId && (
            <form onSubmit={handleSaveEquipo} className="inv-modal-form inv-modal-form--grid">
              <Field label="Marca *">
                <SearchSelect
                  value={equipoForm.brand}
                  onChange={(brand) => setEquipoForm((s) => ({ ...s, brand }))}
                  options={brandOptions}
                  placeholder={deviceBrands.length === 0 ? "Crea marcas en Catálogos" : "Seleccionar marca…"}
                  searchPlaceholder="Buscar marca…"
                  allowClear={false}
                  clearLabel=""
                />
              </Field>
              <Field label="Modelo *">
                <SearchSelect
                  value={equipoForm.model}
                  onChange={(model) => setEquipoForm((s) => ({ ...s, model }))}
                  options={equipoCatalogModelOptions}
                  placeholder={equipoForm.brand ? "Seleccionar o buscar modelo…" : "Selecciona la marca primero…"}
                  searchPlaceholder="Ej. 15 PRO MAX, SE 2022…"
                  allowClear={false}
                  clearLabel=""
                  creatable
                />
              </Field>
              <Field label="Almacenamiento">
                <SearchSelect
                  value={equipoForm.storage}
                  onChange={(storage) => setEquipoForm((s) => ({ ...s, storage }))}
                  options={IPHONE_STORAGE_OPTIONS}
                  placeholder="Seleccionar almacenamiento…"
                  searchPlaceholder="Ej. 256GB, 512GB…"
                  creatable
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
                <CurrencyInput
                  value={equipoForm.reference_price}
                  onChange={(reference_price) => setEquipoForm((s) => ({ ...s, reference_price }))}
                  placeholder="$ 1.780.000"
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
              <p className="inv-product-preview inv-field--span-all">
                Vista previa: <strong>{equipoPreview || "—"}</strong>
              </p>
              <div className="inv-modal__actions inv-field--span-all">
                <button
                  type="button"
                  className="inv-btn inv-btn--outline"
                  onClick={cancelEquipoEdit}
                  disabled={creatingEquipo}
                >
                  Cancelar edición
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={creatingEquipo}>
                  {creatingEquipo ? "Guardando…" : "Actualizar modelo"}
                </button>
              </div>
            </form>
            )}

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

            {!editingEquipoId && (
              <div className="inv-modal__actions inv-modal__actions--solo">
                <button type="button" className="inv-btn inv-btn--outline" onClick={closeEquipoModal}>
                  Cerrar
                </button>
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

      {historyItem && (
        <InventoryHistoryModal
          item={historyItem}
          loading={historyLoading}
          showSensitive={showSensitive}
          onClose={() => {
            setHistoryItem(null);
            setHistoryLoading(false);
          }}
        />
      )}

      {retakeTarget && (
        <div className="inv-modal-overlay" onClick={closeRetakeModal}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">Retomar equipo</h3>
            <p className="inv-dash__muted" style={{ marginTop: 0 }}>
              <strong>{retakeTarget.name}</strong>
              {retakeTarget.imei && showSensitive ? ` · IMEI ${retakeTarget.imei}` : retakeTarget.barcode ? ` · ${retakeTarget.barcode}` : ""}
            </p>
            {retakeTarget.latest_sale && (
              <div className="inv-separado-alert" role="status" style={{ marginBottom: "0.75rem" }}>
                <span className="inv-badge inv-badge--vendido">VENDIDO</span>
                <span className="inv-separado-alert__text">
                  Venta {retakeTarget.latest_sale.remission_number || "—"}
                  {" · "}Precio vendido: <strong>{formatPrice(retakeTarget.latest_sale.sale_price)}</strong>
                  {retakeTarget.latest_sale.payment_method ? (
                    <> · Método: <PaymentMethodBadge method={retakeTarget.latest_sale.payment_method} /></>
                  ) : null}
                  {retakeTarget.latest_sale.customer_name ? ` · ${retakeTarget.latest_sale.customer_name}` : ""}
                  {retakeTarget.latest_sale.amount_due > 0 && (
                    <>
                      {" · "}
                      <span className="inv-badge inv-badge--pending">
                        Saldo pendiente {formatPrice(retakeTarget.latest_sale.amount_due)}
                      </span>
                    </>
                  )}
                </span>
              </div>
            )}
            <form onSubmit={confirmRetake} className="inv-modal-form">
              <Field label="Valor de retoma *">
                <CurrencyInput
                  value={retakePrice}
                  onChange={setRetakePrice}
                  required
                  autoFocus
                />
                <p className="inv-field__hint">
                  Monto que pagas al cliente por el equipo. Actualiza el costo en inventario y registra la salida de caja.
                </p>
              </Field>
              <Field label="Método de pago retoma *">
                <PaymentMethodSelect
                  value={retakePaymentMethod}
                  onChange={(e) => setRetakePaymentMethod(e.target.value)}
                  groups={IMMEDIATE_PAYMENT_GROUPS}
                  required
                />
              </Field>
              <div className="inv-modal__actions">
                <button type="button" className="inv-btn inv-btn--outline" onClick={closeRetakeModal} disabled={Boolean(retakingId)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inv-btn inv-btn--primary inv-btn--inline"
                  disabled={Boolean(retakingId) || (retakeTarget.latest_sale?.amount_due > 0)}
                >
                  {retakingId ? "Guardando…" : "Confirmar retoma"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          open
          tone="warning"
          icon="archive"
          title="¿Archivar equipo?"
          description={
            <>
              Se archivará <strong>{deleteTarget.name}</strong>. El historial se conserva; no se borra el registro.
            </>
          }
          confirmLabel="Archivar"
          loading={Boolean(deletingId)}
          onCancel={() => !deletingId && setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {catalogDeleteTarget && (
        <ConfirmDeleteDialog
          open
          title={
            catalogDeleteTarget.kind === "color"
              ? "¿Eliminar color?"
              : catalogDeleteTarget.kind === "brand"
                ? "¿Eliminar marca?"
                : "¿Eliminar proveedor?"
          }
          itemName={catalogDeleteTarget.name}
          description={
            catalogDeleteTarget.kind === "color" ? (
              <>
                Se eliminará el color <strong>{catalogDeleteTarget.name}</strong> del catálogo.
                Los equipos existentes conservan su color actual.
              </>
            ) : catalogDeleteTarget.kind === "brand" ? (
              <>
                Se eliminará la marca <strong>{catalogDeleteTarget.name}</strong> del catálogo.
                Los modelos existentes conservan el nombre de marca actual hasta que los edites.
              </>
            ) : (
              <>
                Se eliminará el proveedor <strong>{catalogDeleteTarget.name}</strong>.
                Los equipos vinculados mantienen el nombre hasta que los edites.
              </>
            )
          }
          confirmLabel={
            catalogDeleteTarget.kind === "color"
              ? "Eliminar color"
              : catalogDeleteTarget.kind === "brand"
                ? "Eliminar marca"
                : "Eliminar proveedor"
          }
          loading={catalogDeleteLoading}
          onCancel={() => !catalogDeleteLoading && setCatalogDeleteTarget(null)}
          onConfirm={confirmCatalogDelete}
        />
      )}
    </div>
  );
}

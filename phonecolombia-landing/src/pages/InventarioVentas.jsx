import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import CurrencyInput from "../components/inventario/CurrencyInput.jsx";
import CustomerCatalogModal from "../components/inventario/CustomerCatalogModal.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import InventoryItemSelect from "../components/InventoryItemSelect.jsx";
import { useCachedQuery } from "../hooks/useCachedQuery.js";
import api, { isApiConfigured } from "../lib/apiClient";
import RemissionActionMenu from "../components/inventario/RemissionActionMenu.jsx";
import {
  PaymentMethodBadge,
  SalePaidCell,
  SalePendingCell,
} from "../components/inventario/TableValueDisplay.jsx";
import InvIcon from "../components/inventario/InvIcon.jsx";
import PaymentMethodSelect from "../components/inventario/PaymentMethodSelect.jsx";
import {
  ABONO_PAYMENT_GROUPS,
  IMMEDIATE_PAYMENT_GROUPS,
  SALE_PAYMENT_GROUPS,
  paymentLabel,
} from "../lib/paymentMethods.js";
import { invalidateInventarioCache } from "../lib/inventarioCache.js";
import { localDateInputValue } from "../lib/localDate.js";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import {
  Field,
  CREDIT_TERM_OPTIONS,
  canAccessInventory,
  canManageCustomers,
  canManageSales,
  canViewSensitiveInventoryFields,
  creditTermLabel,
  formatPrice,
  parseCop,
  isServiceTechnician,
  serviceCustomerSubtitle,
} from "./inventario/shared.jsx";
import "../styles.css";

const EMPTY_CASH_FORM = {
  type: "ingreso",
  method: "efectivo",
  amount: "",
  concept: "",
  notes: "",
  occurred_at: "",
};

const EMPTY_RESERVE_FORM = {
  inventory_item_id: "",
  sale_price: "",
  service_customer_id: "",
  customer_name: "",
  customer_phone: "",
  deposit_amount: "",
  deposit_method: "efectivo",
  notes: "",
};

const SALES_SORT_COLUMNS = [
  {
    id: "remission",
    label: "Remisión",
    getValue: (sale) => sale.remission_number || "",
  },
  {
    id: "fecha",
    label: "Fecha",
    getValue: (sale) => new Date(sale.sold_at || sale.reserved_at || sale.created_at || 0).getTime(),
  },
  {
    id: "equipo",
    label: "Equipo",
    getValue: (sale) => sale.inventory_item?.name || "",
  },
  {
    id: "precio",
    label: "Precio",
    getValue: (sale) => Number(sale.sale_price) || 0,
  },
  {
    id: "metodo",
    label: "Método",
    getValue: (sale) => paymentLabel(sale.payment_method),
  },
  {
    id: "pagado",
    label: "Pagado",
    getValue: (sale) => Number(sale.amount_paid) || 0,
  },
  {
    id: "pendiente",
    label: "Pendiente",
    getValue: (sale) => Number(sale.amount_due) || 0,
  },
  {
    id: "cliente",
    label: "Cliente",
    getValue: (sale) => sale.customer_name || sale.service_customer?.name || "",
  },
  {
    id: "vendedor",
    label: "Vendedor",
    getValue: (sale) => sale.user?.name || "",
  },
];

function compareSaleValues(a, b, direction) {
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

export default function InventarioVentas() {
  const { user, authChecked, signOut } = useInventarioPage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [completingReservationId, setCompletingReservationId] = useState(null);
  const [cancellingReservationId, setCancellingReservationId] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashForm, setCashForm] = useState(() => ({
    ...EMPTY_CASH_FORM,
    occurred_at: localDateInputValue(),
  }));
  const [cashMovements, setCashMovements] = useState([]);
  const [cashLoading, setCashLoading] = useState(false);
  const [reserveForm, setReserveForm] = useState(EMPTY_RESERVE_FORM);
  const [mixedPayments, setMixedPayments] = useState([
    { ...EMPTY_MIXED_PAYMENT },
    { method: "transferencia", amount: "" },
  ]);
  const [form, setForm] = useState({
    inventory_item_id: "",
    sale_price: "",
    payment_method: "efectivo",
    customer_name: "",
    customer_phone: "",
    service_customer_id: "",
    credit_payment_method_id: "",
    credit_term_type: "",
    credit_due_at: "",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({ method: "efectivo", amount: "", notes: "" });
  const [paymentMixedPayments, setPaymentMixedPayments] = useState([
    { ...EMPTY_MIXED_PAYMENT },
    { method: "transferencia", amount: "" },
  ]);
  const [sortColumn, setSortColumn] = useState("fecha");
  const [sortDirection, setSortDirection] = useState("desc");
  const [barcodeScan, setBarcodeScan] = useState("");
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [scannedItem, setScannedItem] = useState(null);
  const toolbarBarcodeRef = useRef(null);

  const showSensitive = canViewSensitiveInventoryFields(user);
  const isPaymentMixto = paymentForm.method === "mixto";

  const paymentMixedTotal = useMemo(
    () => paymentMixedPayments.reduce((sum, p) => sum + parseCop(p.amount), 0),
    [paymentMixedPayments],
  );

  const openPaymentModal = (sale) => {
    setPaymentModal(sale);
    setPaymentForm({ method: "efectivo", amount: "", notes: "" });
    setPaymentMixedPayments([
      { ...EMPTY_MIXED_PAYMENT },
      { method: "transferencia", amount: "" },
    ]);
  };

  const canReceiveAbono = (sale) => !sale.is_returned && (Number(sale.amount_due) || 0) > 0;

  const isMixto = form.payment_method === "mixto";

  const mixedTotal = useMemo(
    () => mixedPayments.reduce((sum, p) => sum + parseCop(p.amount), 0),
    [mixedPayments],
  );

  const applyItemToSaleForm = useCallback((item) => {
    if (!item) return;
    const reservation = item.active_reservation;
    if (reservation) {
      setCompletingReservationId(reservation.sale_id);
      setEditingSale(null);
      setForm({
        inventory_item_id: item.id,
        sale_price: reservation.sale_price || item.sale_price || "",
        payment_method: "efectivo",
        customer_name: reservation.customer_name || "",
        customer_phone: reservation.customer_phone || "",
        service_customer_id: reservation.service_customer_id || "",
        credit_payment_method_id: "",
        credit_term_type: "",
        credit_due_at: "",
        notes: reservation.notes || "",
      });
      setMixedPayments([
        { ...EMPTY_MIXED_PAYMENT },
        { method: "transferencia", amount: "" },
      ]);
      return;
    }
    setCompletingReservationId(null);
    setForm((s) => ({
      ...s,
      inventory_item_id: item.id,
      sale_price: item.sale_price || s.sale_price,
    }));
  }, []);

  const customerOptions = useMemo(
    () => customers
      .filter((c) => c.is_active !== false)
      .map((c) => ({
        value: c.id,
        label: c.name,
        sublabel: serviceCustomerSubtitle(c) || undefined,
      })),
    [customers],
  );

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await api.getServiceCustomers({ active_only: true });
      setCustomers(data || []);
      return data || [];
    } catch {
      return [];
    }
  }, []);

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

  const preselectItemId = searchParams.get("item");
  const preselectHandled = useRef(false);

  const salesEnabled = authChecked && Boolean(user) && canManageSales(user);

  const {
    data: salesBootstrap,
    loading,
    refreshing,
    setData: setSalesBootstrap,
    refetch: reloadSales,
  } = useCachedQuery(
    ["salesBootstrap"],
    () => api.bootstrapSales(),
    { enabled: salesEnabled },
  );

  const sales = salesBootstrap?.sales || [];
  const sortedSales = useMemo(() => {
    const column = SALES_SORT_COLUMNS.find((c) => c.id === sortColumn) || SALES_SORT_COLUMNS[1];
    const rows = [...sales];
    rows.sort((a, b) => compareSaleValues(column.getValue(a), column.getValue(b), sortDirection));
    return rows;
  }, [sales, sortColumn, sortDirection]);
  const availableItems = salesBootstrap?.available_items || [];
  const creditMethods = salesBootstrap?.credit_config?.methods || [];
  const creditSettings = salesBootstrap?.credit_config?.settings || { billing_day: 15 };

  const addAvailableItem = useCallback((item) => {
    if (!item) return;
    setSalesBootstrap((prev) => {
      const base = prev || { sales: [], available_items: [] };
      if ((base.available_items || []).some((i) => i.id === item.id)) return base;
      return { ...base, available_items: [...(base.available_items || []), item] };
    });
  }, [setSalesBootstrap]);

  const patchSalesAfterMutation = useCallback((updater) => {
    setSalesBootstrap((prev) => {
      const base = prev || { sales: [], available_items: [] };
      return typeof updater === "function" ? updater(base) : updater;
    });
    invalidateInventarioCache("dashboard", "inventory");
  }, [setSalesBootstrap]);

  useEffect(() => {
    if (!user || modalOpen || paymentModal) return;
    requestAnimationFrame(() => toolbarBarcodeRef.current?.focus());
  }, [user, modalOpen, paymentModal]);

  useEffect(() => {
    if (salesEnabled) fetchCustomers();
  }, [salesEnabled, fetchCustomers]);

  const loadCashMovements = useCallback(async () => {
    if (!salesEnabled) return;
    setCashLoading(true);
    try {
      const today = localDateInputValue();
      const res = await api.getCashMovements({ from: today, to: today });
      setCashMovements(res?.data || []);
    } catch {
      setCashMovements([]);
    } finally {
      setCashLoading(false);
    }
  }, [salesEnabled]);

  useEffect(() => {
    loadCashMovements();
  }, [loadCashMovements]);

  const openCashModal = (type = "ingreso") => {
    setCashForm({
      ...EMPTY_CASH_FORM,
      type,
      occurred_at: localDateInputValue(),
    });
    setCashModalOpen(true);
  };

  const handleCashSubmit = async (e) => {
    e.preventDefault();
    const amount = parseCop(cashForm.amount);
    if (amount <= 0) {
      showToast("Ingresa un monto válido", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.createCashMovement({
        type: cashForm.type,
        method: cashForm.method,
        amount,
        concept: cashForm.concept.trim() || null,
        notes: cashForm.notes.trim() || null,
        occurred_at: cashForm.occurred_at || localDateInputValue(),
      });
      showToast(cashForm.type === "egreso" ? "Egreso registrado" : "Ingreso registrado");
      setCashModalOpen(false);
      await loadCashMovements();
      invalidateInventarioCache("reports");
    } catch (err) {
      showToast(err.message || "No se pudo registrar el movimiento", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCashMovement = async (id) => {
    if (!window.confirm("¿Eliminar este movimiento de caja?")) return;
    try {
      await api.deleteCashMovement(id);
      showToast("Movimiento eliminado");
      await loadCashMovements();
      invalidateInventarioCache("reports");
    } catch (err) {
      showToast(err.message || "No se pudo eliminar", "error");
    }
  };

  const applyPreselectedItem = useCallback((item) => {
    if (!item || preselectHandled.current) return;
    preselectHandled.current = true;
    addAvailableItem(item);
    setScannedItem(item);
    applyItemToSaleForm(item);
    setModalOpen(true);
    setSearchParams({}, { replace: true });
  }, [addAvailableItem, applyItemToSaleForm, setSearchParams]);

  useEffect(() => {
    if (!preselectItemId || preselectHandled.current) return;
    const item = availableItems.find((i) => i.id === preselectItemId);
    if (item) {
      applyPreselectedItem(item);
      return undefined;
    }
    if (loading || !salesBootstrap) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const detail = await api.getInventoryItem(preselectItemId);
        if (cancelled || preselectHandled.current) return;
        if (detail && (detail.status === "disponible" || detail.status === "separado")) {
          applyPreselectedItem(detail);
        }
      } catch {
        // Equipo no encontrado o sin acceso
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preselectItemId, availableItems, loading, salesBootstrap, applyPreselectedItem]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const onItemSelect = (id) => {
    const item = availableItems.find((i) => i.id === id) || (scannedItem?.id === id ? scannedItem : null);
    if (item && !availableItems.some((i) => i.id === item.id)) {
      addAvailableItem(item);
    }
    applyItemToSaleForm(item);
    setScannedItem(item || null);
  };

  const lookupIdentifier = useCallback(async (code) => {
    const trimmed = String(code || "").trim();
    if (!trimmed) return;

    setScanningBarcode(true);
    try {
      const items = await api.getInventory({ identifier: trimmed });
      const eligible = items?.filter((i) => i.status === "disponible" || i.status === "separado") || [];
      const item = eligible[0];
      if (!item) {
        setScannedItem(null);
        showToast("No hay equipo disponible o separado con ese código de barras o IMEI", "error");
        return;
      }
      if (eligible.length > 1) {
        showToast("Código duplicado en inventario. Contacta al administrador.", "error");
        return;
      }
      addAvailableItem(item);
      setScannedItem(item);
      applyItemToSaleForm(item);
      setBarcodeScan("");
      setEditingSale(null);
      setModalOpen(true);
      showToast(`Equipo agregado: ${item.name}`, "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setScanningBarcode(false);
    }
  }, [addAvailableItem, applyItemToSaleForm, showToast]);

  const handleBarcodeKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupIdentifier(barcodeScan);
    }
  };

  const openSaleModal = () => {
    resetSaleForm();
    setModalOpen(true);
  };

  const resetSaleForm = () => {
    setForm({
      inventory_item_id: "",
      sale_price: "",
      payment_method: "efectivo",
      customer_name: "",
      customer_phone: "",
      service_customer_id: "",
      credit_payment_method_id: "",
      credit_term_type: "",
      credit_due_at: "",
      notes: "",
    });
    setMixedPayments([{ ...EMPTY_MIXED_PAYMENT }, { method: "transferencia", amount: "" }]);
    setBarcodeScan("");
    setScannedItem(null);
    setEditingSale(null);
    setCompletingReservationId(null);
  };

  const openEditSale = (sale) => {
    setCompletingReservationId(null);
    setEditingSale(sale);
    setScannedItem(sale.inventory_item || null);
    setForm({
      inventory_item_id: sale.inventory_item_id,
      sale_price: sale.sale_price || "",
      payment_method: sale.payment_method || "efectivo",
      customer_name: sale.customer_name || "",
      customer_phone: sale.customer_phone || "",
      service_customer_id: sale.service_customer_id || "",
      credit_payment_method_id: sale.credit_payment_method_id || "",
      credit_term_type: sale.credit_term_type || "",
      credit_due_at: sale.credit_due_at ? String(sale.credit_due_at).slice(0, 10) : "",
      notes: sale.notes || "",
    });
    setModalOpen(true);
  };

  const selectedSaleItem = useMemo(() => {
    if (!form.inventory_item_id) return scannedItem;
    if (scannedItem?.id === form.inventory_item_id) return scannedItem;
    return availableItems.find((i) => i.id === form.inventory_item_id) || scannedItem;
  }, [form.inventory_item_id, scannedItem, availableItems]);

  const activeReservation = selectedSaleItem?.active_reservation ?? null;
  const reservationPending = activeReservation ? Number(activeReservation.amount_due) || 0 : 0;

  const needsCreditMeta = useMemo(() => {
    const salePriceNum = parseCop(form.sale_price);
    const pendingTarget = completingReservationId ? reservationPending : salePriceNum;
    if (form.payment_method === "credito") return true;
    if (form.payment_method === "mixto" && mixedTotal < pendingTarget) return true;
    return false;
  }, [form.payment_method, form.sale_price, mixedTotal, completingReservationId, reservationPending]);

  const resetReserveForm = () => {
    setReserveForm(EMPTY_RESERVE_FORM);
  };

  const openReserveModal = () => {
    resetReserveForm();
    setReserveModalOpen(true);
  };

  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    if (!reserveForm.inventory_item_id) {
      showToast("Selecciona un equipo disponible", "error");
      return;
    }
    if (!reserveForm.sale_price) {
      showToast("Indica el precio acordado del apartado", "error");
      return;
    }

    const deposit = parseCop(reserveForm.deposit_amount);
    if (deposit > 0 && !reserveForm.deposit_method) {
      showToast("Indica el método de pago del abono", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sale_price: String(parseCop(reserveForm.sale_price) || reserveForm.sale_price),
        deposit_amount: deposit || undefined,
        deposit_method: deposit > 0 ? reserveForm.deposit_method : undefined,
        service_customer_id: reserveForm.service_customer_id || undefined,
        customer_name: reserveForm.customer_name || undefined,
        customer_phone: reserveForm.customer_phone || undefined,
        notes: reserveForm.notes || undefined,
      };

      const response = await api.reserveInventoryItem(reserveForm.inventory_item_id, payload);
      const sale = response.reservation || response;
      showToast(deposit > 0 ? "Apartado registrado con abono" : "Apartado registrado");
      setReserveModalOpen(false);
      resetReserveForm();
      await fetchCustomers();
      patchSalesAfterMutation((prev) => ({
        sales: sale?.id ? [sale, ...(prev.sales || [])] : prev.sales || [],
        available_items: (prev.available_items || []).filter((i) => i.id !== reserveForm.inventory_item_id),
      }));
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    if (!editingSale && !form.inventory_item_id) {
      showToast("Selecciona un equipo", "error");
      return;
    }

    const payload = { ...form };
    if (!payload.service_customer_id) delete payload.service_customer_id;
    if (!payload.credit_payment_method_id) delete payload.credit_payment_method_id;
    if (!payload.credit_term_type) delete payload.credit_term_type;
    if (!payload.credit_due_at) delete payload.credit_due_at;

    const salePriceNum = parseCop(form.sale_price);
    const payTarget = completingReservationId ? reservationPending : salePriceNum;
    if (isMixto && !editingSale) {
      const validPayments = mixedPayments
        .filter((p) => parseCop(p.amount) > 0)
        .map((p) => ({ method: p.method, amount: parseCop(p.amount) }));
      if (validPayments.length < 2) {
        showToast("Agrega al menos dos pagos para venta mixta", "error");
        return;
      }
      const paidTotal = validPayments.reduce((sum, p) => sum + p.amount, 0);
      if (paidTotal > payTarget) {
        showToast(completingReservationId
          ? "El total pagado no puede superar el saldo pendiente del apartado"
          : "El total pagado no puede superar el precio de venta", "error");
        return;
      }
      payload.payments = validPayments;
    }

    const requiresCredit = form.payment_method === "credito"
      || (isMixto && mixedTotal < payTarget);
    if (requiresCredit) {
      if (!form.credit_payment_method_id) {
        showToast("Selecciona el medio de pago de crédito (Addi, Sistecredito, etc.)", "error");
        return;
      }
      if (!form.credit_term_type) {
        showToast("Selecciona el plazo de crédito", "error");
        return;
      }
    }

    if (!editingSale && !completingReservationId && selectedSaleItem?.status === "separado") {
      const apartadoNote = selectedSaleItem.notes?.trim();
      const confirmMsg = apartadoNote
        ? `Este equipo está SEPARADO sin apartado formal.\n\n${apartadoNote}\n\n¿Confirmar venta?`
        : "Este equipo está SEPARADO sin apartado formal. ¿Confirmar venta?";
      if (!window.confirm(confirmMsg)) return;
    }

    setSubmitting(true);
    try {
      if (editingSale) {
        const { inventory_item_id, payments, ...updatePayload } = payload;
        const sale = await api.updateSale(editingSale.id, updatePayload);
        showToast("Venta actualizada");
        setModalOpen(false);
        resetSaleForm();
        patchSalesAfterMutation((prev) => ({
          ...prev,
          sales: (prev.sales || []).map((s) => (s.id === sale.id ? sale : s)),
        }));
      } else if (completingReservationId) {
        const { inventory_item_id, ...completePayload } = payload;
        const sale = await api.completeReservation(completingReservationId, completePayload);
        showToast("Apartado completado — venta registrada");
        setModalOpen(false);
        resetSaleForm();
        patchSalesAfterMutation((prev) => ({
          sales: [sale, ...(prev.sales || []).filter((s) => s.id !== completingReservationId)],
          available_items: (prev.available_items || []).filter((i) => i.id !== payload.inventory_item_id),
        }));
      } else {
        const sale = await api.createSale(payload);
        showToast("Venta registrada");
        setModalOpen(false);
        resetSaleForm();
        await fetchCustomers();
        patchSalesAfterMutation((prev) => ({
          sales: [sale, ...(prev.sales || [])],
          available_items: (prev.available_items || []).filter((i) => i.id !== payload.inventory_item_id),
        }));
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async (sale) => {
    const itemName = sale.inventory_item?.name || "este equipo";
    const paid = Number(sale.amount_paid) || 0;
    const paidNote = paid > 0
      ? `\n\nSe registraron abonos por ${formatPrice(paid)}. El historial se conserva.`
      : "";
    if (!window.confirm(`¿Cancelar el apartado de ${itemName}?${paidNote}\n\nEl equipo volverá a Disponible.`)) {
      return;
    }

    setCancellingReservationId(sale.id);
    try {
      const updated = await api.cancelReservation(sale.id);
      showToast("Apartado cancelado");
      const availableItem = updated.inventory_item;
      patchSalesAfterMutation((prev) => {
        const next = {
          ...prev,
          sales: (prev.sales || []).map((s) => (s.id === updated.id ? updated : s)),
        };
        if (availableItem?.id && availableItem.status === "disponible") {
          const items = next.available_items || [];
          if (!items.some((i) => i.id === availableItem.id)) {
            next.available_items = [...items, availableItem];
          }
        }
        return next;
      });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCancellingReservationId(null);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentModal) return;

    const amountDue = Number(paymentModal.amount_due) || 0;
    let payload = { notes: paymentForm.notes || undefined };

    if (isPaymentMixto) {
      const validPayments = paymentMixedPayments
        .filter((p) => parseCop(p.amount) > 0)
        .map((p) => ({ method: p.method, amount: parseCop(p.amount) }));
      if (validPayments.length < 2) {
        showToast("Agrega al menos dos pagos para abono mixto", "error");
        return;
      }
      const paidTotal = validPayments.reduce((sum, p) => sum + p.amount, 0);
      if (paidTotal > amountDue) {
        showToast("El total del abono no puede superar el saldo pendiente", "error");
        return;
      }
      if (paidTotal <= 0) {
        showToast("Indica el monto del abono", "error");
        return;
      }
      payload = { ...payload, method: "mixto", payments: validPayments };
    } else {
      const amount = parseCop(paymentForm.amount);
      if (amount <= 0) {
        showToast("Indica el monto del abono", "error");
        return;
      }
      if (amount > amountDue) {
        showToast("El abono no puede superar el saldo pendiente", "error");
        return;
      }
      payload = { ...payload, method: paymentForm.method, amount };
    }

    setSubmitting(true);
    try {
      const sale = await api.addSalePayment(paymentModal.id, payload);
      showToast("Abono registrado");
      setPaymentModal(null);
      setPaymentForm({ method: "efectivo", amount: "", notes: "" });
      setPaymentMixedPayments([
        { ...EMPTY_MIXED_PAYMENT },
        { method: "transferencia", amount: "" },
      ]);
      patchSalesAfterMutation((prev) => ({
        ...prev,
        sales: (prev.sales || []).map((s) => (s.id === sale.id ? sale : s)),
      }));
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSort = useCallback((columnId) => {
    if (sortColumn === columnId) {
      setSortDirection((dir) => (dir === "desc" ? "asc" : "desc"));
      return;
    }
    setSortColumn(columnId);
    setSortDirection("desc");
  }, [sortColumn]);

  if (!isApiConfigured || !authChecked || !user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
      </div>
    );
  }

  const onCustomerPick = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    setForm((s) => ({
      ...s,
      service_customer_id: customerId,
      customer_name: customer?.name || "",
      customer_phone: customer?.phone || "",
    }));
  };

  const onReserveCustomerPick = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    setReserveForm((s) => ({
      ...s,
      service_customer_id: customerId,
      customer_name: customer?.name || "",
      customer_phone: customer?.phone || "",
    }));
  };

  const handleCustomersUpdated = (rows, createdCustomer = null) => {
    setCustomers(rows || []);
    if (createdCustomer?.id) {
      onCustomerPick(createdCustomer.id);
    }
  };

  if (isServiceTechnician(user)) {
    return <Navigate to="/admin/inventario/servicio-tecnico" replace />;
  }

  if (!canManageSales(user)) {
    return canAccessInventory(user) ? <Navigate to="/admin/inventario" replace /> : <Navigate to="/admin" replace />;
  }

  return (
    <div className="inv-dash">
      <InventarioTopbar current="ventas" title="Ventas" subtitle="Registro de ventas y créditos" user={user} onSignOut={signOut} />
      <main className="inv-main inv-main--sheet">
        <section className="inv-panel inv-panel--sheet">
          <div className="inv-sheet-toolbar">
            <div className="inv-sheet-toolbar__main">
              <h2 className="inv-panel__title inv-panel__title--toolbar" style={{ margin: 0 }}>Historial de ventas</h2>
              <label className="inv-sale-scan">
                <span className="inv-sale-scan__label">Código de barras / IMEI</span>
                <input
                  ref={toolbarBarcodeRef}
                  className="inv-sale-scan__input inv-field__input--mono"
                  placeholder="Escanear código de barras o IMEI…"
                  value={barcodeScan}
                  onChange={(e) => setBarcodeScan(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  disabled={scanningBarcode || modalOpen}
                  autoComplete="off"
                  aria-label="Escanear código de barras o IMEI"
                />
              </label>
            </div>
            <div className="inv-sheet-actions">
              {canManageCustomers(user) && (
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setCustomerModalOpen(true)}>
                  <InvIcon name="user-plus" />
                  Cliente
                </button>
              )}
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => openCashModal("ingreso")}>
                <InvIcon name="wallet" />
                Ingreso / Egreso
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={openReserveModal}>
                <InvIcon name="bookmark" />
                Apartar equipo
              </button>
              <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openSaleModal}>
                <InvIcon name="cart-plus" />
                Nueva venta
              </button>
              <button type="button" className="inv-btn inv-btn--ghost" onClick={reloadSales} disabled={loading || refreshing}>
                <InvIcon name="refresh" spin={loading || refreshing} />
                Actualizar
              </button>
            </div>
          </div>
          <div className="inv-table-wrap inv-table-wrap--sheet">
            <table className="inv-table inv-table--sheet">
              <thead>
                <tr>
                  {SALES_SORT_COLUMNS.map((column) => (
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
              <tbody>
                {loading && !salesBootstrap ? (
                  <tr><td colSpan={10} className="inv-sheet-empty">Cargando…</td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan={10} className="inv-sheet-empty">No hay ventas registradas.</td></tr>
                ) : (
                  sortedSales.map((sale) => (
                    <tr key={sale.id} className="inv-sheet-row">
                      <td data-label="Remisión">
                        <strong className="inv-cell-mono">{sale.remission_number || "—"}</strong>
                      </td>
                      <td data-label="Fecha">
                        {sale.sold_at
                          ? new Date(sale.sold_at).toLocaleString("es-CO")
                          : sale.reserved_at
                            ? `Apartado ${new Date(sale.reserved_at).toLocaleDateString("es-CO")}`
                            : "—"}
                      </td>
                      <td data-label="Equipo">
                        {sale.inventory_item?.name || "—"}
                        {sale.reservation_status === "active" && (
                          <span className="inv-badge inv-badge--separado" style={{ marginLeft: "0.35rem" }}>Apartado</span>
                        )}
                        {sale.is_returned && (
                          <span className="inv-badge inv-badge--retomado" style={{ marginLeft: "0.35rem" }}>Devuelto</span>
                        )}
                      </td>
                      <td data-label="Precio"><span className="inv-cell-mono">{formatPrice(sale.sale_price)}</span></td>
                      <td data-label="Método"><PaymentMethodBadge method={sale.payment_method} /></td>
                      <td data-label="Pagado"><SalePaidCell amountPaid={sale.amount_paid} salePrice={sale.sale_price} /></td>
                      <td data-label="Pendiente"><SalePendingCell amountDue={sale.amount_due} /></td>
                      <td data-label="Cliente">{sale.customer_name || sale.service_customer?.name || "—"}</td>
                      <td data-label="Vendedor">{sale.user?.name || "—"}</td>
                      <td data-label="Acciones">
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          {sale.remission_number && (
                            <RemissionActionMenu
                              saleId={sale.id}
                              remissionNumber={sale.remission_number}
                              onNotify={showToast}
                            />
                          )}
                          <button
                            type="button"
                            className="inv-btn inv-btn--compact inv-btn--ghost"
                            onClick={() => openEditSale(sale)}
                            disabled={sale.is_returned}
                          >
                            <InvIcon name="pencil" />
                            Editar
                          </button>
                          {sale.reservation_status === "active" && (
                            <>
                              <button
                                type="button"
                                className="inv-btn inv-btn--compact inv-btn--primary"
                                onClick={() => {
                                  const item = sale.inventory_item;
                                  if (item) {
                                    addAvailableItem({ ...item, active_reservation: {
                                      sale_id: sale.id,
                                      sale_price: sale.sale_price,
                                      amount_paid: sale.amount_paid,
                                      amount_due: sale.amount_due,
                                      customer_name: sale.customer_name,
                                      customer_phone: sale.customer_phone,
                                      service_customer_id: sale.service_customer_id,
                                      notes: sale.notes,
                                    } });
                                    applyItemToSaleForm({
                                      ...item,
                                      active_reservation: {
                                        sale_id: sale.id,
                                        sale_price: sale.sale_price,
                                        amount_paid: sale.amount_paid,
                                        amount_due: sale.amount_due,
                                        customer_name: sale.customer_name,
                                        customer_phone: sale.customer_phone,
                                        service_customer_id: sale.service_customer_id,
                                        notes: sale.notes,
                                      },
                                    });
                                    setScannedItem(item);
                                    setModalOpen(true);
                                  }
                                }}
                              >
                                <InvIcon name="check-circle" />
                                Completar
                              </button>
                              <button
                                type="button"
                                className="inv-btn inv-btn--compact inv-btn--danger"
                                onClick={() => handleCancelReservation(sale)}
                                disabled={cancellingReservationId === sale.id}
                              >
                                <InvIcon name="x-circle" spin={cancellingReservationId === sale.id} />
                                Cancelar
                              </button>
                            </>
                          )}
                          {canReceiveAbono(sale) && (
                            <button
                              type="button"
                              className="inv-btn inv-btn--compact inv-btn--outline"
                              onClick={() => openPaymentModal(sale)}
                            >
                              <InvIcon name="wallet" />
                              Abonar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="inv-panel inv-panel--sheet" style={{ marginTop: "1rem" }}>
          <div className="inv-sheet-toolbar">
            <div className="inv-sheet-toolbar__main">
              <h2 className="inv-panel__title inv-panel__title--toolbar" style={{ margin: 0 }}>
                Ingresos y egresos de caja (hoy)
              </h2>
            </div>
            <div className="inv-sheet-actions">
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => openCashModal("ingreso")}>
                <InvIcon name="plus" />
                Registrar ingreso
              </button>
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => openCashModal("egreso")}>
                <InvIcon name="wallet" />
                Registrar egreso
              </button>
            </div>
          </div>
          <p className="inv-dash__muted" style={{ margin: "0 0 0.75rem", padding: "0 1rem" }}>
            Movimientos manuales del día. También aparecen en el Cuadre de caja con origen <strong>Manual</strong>
            (los cobros de venta y retomas se agregan solos).
          </p>
          <div className="inv-table-wrap inv-table-wrap--sheet">
            <table className="inv-table inv-table--sheet">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th>Monto</th>
                  <th>Responsable</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cashLoading && cashMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="inv-empty">Cargando…</td>
                  </tr>
                ) : cashMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="inv-empty">Sin movimientos manuales hoy.</td>
                  </tr>
                ) : (
                  cashMovements.map((mov) => (
                    <tr key={mov.id} className="inv-sheet-row">
                      <td data-label="Hora">
                        {mov.occurred_at
                          ? new Date(mov.occurred_at.replace(" ", "T")).toLocaleTimeString("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td data-label="Tipo">
                        <span className={`inv-badge inv-badge--${mov.type === "egreso" ? "amber" : "disponible"}`}>
                          {mov.type_label}
                        </span>
                      </td>
                      <td data-label="Concepto">{mov.concept || "—"}</td>
                      <td data-label="Método"><PaymentMethodBadge method={mov.method} /></td>
                      <td data-label="Monto" className={mov.type === "egreso" ? "inv-amount--out" : "inv-amount--in"}>
                        {formatPrice(mov.amount)}
                      </td>
                      <td data-label="Responsable">{mov.user?.name || "—"}</td>
                      <td data-label="Acciones">
                        <button
                          type="button"
                          className="inv-btn inv-btn--compact inv-btn--danger"
                          onClick={() => handleDeleteCashMovement(mov.id)}
                        >
                          <InvIcon name="trash" />
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {modalOpen && (
        <div className="inv-modal-overlay" onClick={() => !submitting && setModalOpen(false)}>
          <div className="inv-modal inv-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">
              {editingSale ? "Editar venta" : completingReservationId ? "Completar apartado" : "Registrar venta"}
            </h3>
            <form onSubmit={handleCreateSale} className="inv-modal-form inv-modal-form--grid">
              {scannedItem && (
                <p className="inv-audit-entity__summary inv-field--span-all" style={{ margin: 0 }}>
                  Equipo: <strong>{scannedItem.name}</strong>
                  {scannedItem.barcode ? ` · ${scannedItem.barcode}` : ""}
                  {showSensitive && scannedItem.imei ? ` · IMEI ${scannedItem.imei}` : ""}
                  {scannedItem.sale_price ? ` · ${formatPrice(scannedItem.sale_price)}` : ""}
                </p>
              )}

              {activeReservation && !editingSale && (
                <div className="inv-separado-alert inv-field--span-all" role="status">
                  <span className="inv-badge inv-badge--separado">APARTADO</span>
                  <span>
                    Abono registrado: <strong>{formatPrice(activeReservation.amount_paid)}</strong>
                    {" · "}Saldo pendiente: <strong>{formatPrice(activeReservation.amount_due)}</strong>
                    {activeReservation.customer_name ? ` · ${activeReservation.customer_name}` : ""}
                  </span>
                </div>
              )}

              {!editingSale && !activeReservation && selectedSaleItem?.status === "separado" && (
                <div className="inv-separado-alert inv-field--span-all" role="status">
                  <span className="inv-badge inv-badge--separado">SEPARADO</span>
                  <span>
                    Equipo apartado sin abono formal. Verifica al cliente antes de vender.
                    {selectedSaleItem.notes?.trim() ? (
                      <> <strong>Notas:</strong> {selectedSaleItem.notes.trim()}</>
                    ) : null}
                  </span>
                </div>
              )}

              {!editingSale && (
              <Field label="Equipo disponible *" className="inv-field--span-all">
                <InventoryItemSelect
                  items={availableItems}
                  value={form.inventory_item_id}
                  onChange={onItemSelect}
                  showSensitive={showSensitive}
                  placeholder="Buscar equipo…"
                  allowClear={false}
                  clearLabel="Seleccionar…"
                />
              </Field>
              )}

              <Field label="Precio de venta *">
                <CurrencyInput
                  value={form.sale_price}
                  onChange={(sale_price) => setForm((s) => ({ ...s, sale_price }))}
                  required
                />
              </Field>
              <Field label="Método de pago *">
                <PaymentMethodSelect
                  value={form.payment_method}
                  onChange={(e) => setForm((s) => ({ ...s, payment_method: e.target.value }))}
                  groups={SALE_PAYMENT_GROUPS}
                  disabled={Boolean(editingSale)}
                  required
                />
                {editingSale && (
                  <p className="inv-field__hint">Los pagos registrados no se modifican al editar.</p>
                )}
              </Field>

              {form.payment_method === "credito" && (
                <p className="inv-dash__muted inv-field--span-all" style={{ margin: 0 }}>
                  El monto total quedará pendiente de cobro. Debes indicar medio de crédito y plazo.
                </p>
              )}

              {isMixto && needsCreditMeta && (
                <p className="inv-dash__muted inv-field--span-all" style={{ margin: 0 }}>
                  El saldo no cubierto por el mixto quedará en cartera. Indica medio y plazo de crédito.
                </p>
              )}

              {needsCreditMeta && (
                <>
                  <Field label="Medio de pago crédito *">
                    <select
                      className="inv-field__input"
                      value={form.credit_payment_method_id}
                      onChange={(e) => setForm((s) => ({ ...s, credit_payment_method_id: e.target.value }))}
                      required
                    >
                      <option value="">Seleccionar…</option>
                      {creditMethods.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Plazo de crédito *">
                    <select
                      className="inv-field__input"
                      value={form.credit_term_type}
                      onChange={(e) => setForm((s) => ({ ...s, credit_term_type: e.target.value, credit_due_at: "" }))}
                      required
                    >
                      <option value="">Seleccionar…</option>
                      {CREDIT_TERM_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  {form.credit_term_type === "custom" && (
                    <Field label={`Vencimiento (corte día ${creditSettings.billing_day ?? 15}) o fecha manual`}>
                      <input
                        type="date"
                        className="inv-field__input"
                        value={form.credit_due_at}
                        onChange={(e) => setForm((s) => ({ ...s, credit_due_at: e.target.value }))}
                      />
                      <p className="inv-field__hint">Si lo dejas vacío, se usará la próxima fecha de corte.</p>
                    </Field>
                  )}
                </>
              )}

              {editingSale && form.payment_method === "mixto" && (editingSale.payments?.length ?? 0) > 0 && (
                <div className="inv-field--span-all">
                  <p className="inv-field__label">Pagos registrados</p>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                    {editingSale.payments.map((payment) => (
                      <li key={payment.id || `${payment.method}-${payment.amount}`}>
                        {paymentLabel(payment.method)}: {formatPrice(payment.amount)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isMixto && !editingSale && (
                <div className="inv-field--span-all">
                  <p className="inv-field__label">Pagos mixtos (mínimo 2 métodos de contado)</p>
                  {mixedPayments.map((p, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <PaymentMethodSelect
                        value={p.method}
                        onChange={(e) => setMixedPayments((rows) => rows.map((r, i) => (i === idx ? { ...r, method: e.target.value } : r)))}
                        groups={IMMEDIATE_PAYMENT_GROUPS}
                      />
                      <CurrencyInput
                        placeholder="$ 0"
                        value={p.amount}
                        onChange={(amount) => setMixedPayments((rows) => rows.map((r, i) => (i === idx ? { ...r, amount } : r)))}
                      />
                      {mixedPayments.length > 2 && (
                        <button
                          type="button"
                          className="inv-btn inv-btn--ghost"
                          onClick={() => setMixedPayments((rows) => rows.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="inv-btn inv-btn--outline inv-btn--compact"
                    onClick={() => setMixedPayments((rows) => [...rows, { ...EMPTY_MIXED_PAYMENT }])}
                  >
                    + Agregar pago
                  </button>
                  <p className="inv-dash__muted" style={{ marginTop: "0.5rem" }}>
                    Total pagos: {formatPrice(mixedTotal)}
                    {completingReservationId && activeReservation ? (
                      <> · Saldo apartado: {formatPrice(reservationPending)}</>
                    ) : form.sale_price ? (
                      <> · Precio venta: {formatPrice(form.sale_price)}</>
                    ) : null}
                    {completingReservationId && reservationPending > 0 && mixedTotal < reservationPending && mixedTotal > 0 && (
                      <> · Quedará pendiente: {formatPrice(reservationPending - mixedTotal)}</>
                    )}
                    {!completingReservationId && form.sale_price && mixedTotal < parseCop(form.sale_price) && mixedTotal > 0 && (
                      <> · Pendiente: {formatPrice(parseCop(form.sale_price) - mixedTotal)}</>
                    )}
                    {(completingReservationId ? mixedTotal > reservationPending : form.sale_price && mixedTotal > parseCop(form.sale_price)) && (
                      <span style={{ color: "var(--inv-danger, #f87171)" }}> · Supera el monto permitido</span>
                    )}
                  </p>
                </div>
              )}

              <Field label="Cliente" className="inv-field--span-all">
                <SearchSelect
                  value={form.service_customer_id || ""}
                  onChange={(id) => {
                    if (!id) {
                      setForm((s) => ({ ...s, service_customer_id: "" }));
                      return;
                    }
                    onCustomerPick(id);
                  }}
                  options={customerOptions}
                  placeholder="Buscar cliente registrado…"
                />
              </Field>
              {!form.service_customer_id && (
                <>
                  <Field label="Nombre">
                    <input
                      className="inv-field__input"
                      value={form.customer_name}
                      onChange={(e) => setForm((s) => ({ ...s, customer_name: e.target.value }))}
                      placeholder="Nombre del cliente"
                    />
                  </Field>
                  <Field label="Teléfono">
                    <input
                      className="inv-field__input"
                      value={form.customer_phone}
                      onChange={(e) => setForm((s) => ({ ...s, customer_phone: e.target.value }))}
                      placeholder="300 123 4567"
                    />
                  </Field>
                  <p className="inv-field__hint inv-field--span-all" style={{ margin: 0 }}>
                    Si no está en el catálogo, se crea o vincula automáticamente al guardar.
                  </p>
                </>
              )}
              <Field label="Notas" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </Field>
              <div className="inv-modal__actions inv-field--span-all">
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setModalOpen(false)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={submitting}>
                  {submitting ? "Guardando…" : editingSale ? "Guardar cambios" : completingReservationId ? "Completar apartado" : "Registrar venta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reserveModalOpen && (
        <div className="inv-modal-overlay" onClick={() => !submitting && setReserveModalOpen(false)}>
          <div className="inv-modal inv-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">Apartar equipo</h3>
            <p className="inv-dash__muted" style={{ marginTop: 0 }}>
              Registra el apartado con abono opcional. El equipo quedará separado hasta completar la venta.
            </p>
            <form onSubmit={handleReserveSubmit} className="inv-modal-form inv-modal-form--grid">
              <Field label="Equipo disponible *" className="inv-field--span-all">
                <InventoryItemSelect
                  items={availableItems.filter((item) => item.status === "disponible")}
                  value={reserveForm.inventory_item_id}
                  onChange={(id) => {
                    const item = availableItems.find((i) => i.id === id);
                    setReserveForm((s) => ({
                      ...s,
                      inventory_item_id: id || "",
                      sale_price: item?.sale_price || s.sale_price,
                    }));
                  }}
                  showSensitive={showSensitive}
                  placeholder="Buscar equipo disponible…"
                  allowClear={false}
                  clearLabel=""
                />
              </Field>
              <Field label="Precio acordado *">
                <CurrencyInput
                  value={reserveForm.sale_price}
                  onChange={(sale_price) => setReserveForm((s) => ({ ...s, sale_price }))}
                  placeholder="$ 0"
                />
              </Field>
              <Field label="Abono inicial (opcional)">
                <CurrencyInput
                  value={reserveForm.deposit_amount}
                  onChange={(deposit_amount) => setReserveForm((s) => ({ ...s, deposit_amount }))}
                  placeholder="$ 0"
                />
              </Field>
              <Field label="Método abono">
                <PaymentMethodSelect
                  value={reserveForm.deposit_method}
                  onChange={(e) => setReserveForm((s) => ({ ...s, deposit_method: e.target.value }))}
                  groups={IMMEDIATE_PAYMENT_GROUPS}
                />
              </Field>
              <Field label="Cliente" className="inv-field--span-all">
                <SearchSelect
                  value={reserveForm.service_customer_id || ""}
                  onChange={(id) => {
                    if (!id) {
                      setReserveForm((s) => ({ ...s, service_customer_id: "" }));
                      return;
                    }
                    onReserveCustomerPick(id);
                  }}
                  options={customerOptions}
                  placeholder="Buscar cliente registrado…"
                />
              </Field>
              {!reserveForm.service_customer_id && (
                <>
                  <Field label="Nombre">
                    <input
                      className="inv-field__input"
                      value={reserveForm.customer_name}
                      onChange={(e) => setReserveForm((s) => ({ ...s, customer_name: e.target.value }))}
                      placeholder="Nombre del cliente"
                    />
                  </Field>
                  <Field label="Teléfono">
                    <input
                      className="inv-field__input"
                      value={reserveForm.customer_phone}
                      onChange={(e) => setReserveForm((s) => ({ ...s, customer_phone: e.target.value }))}
                      placeholder="300 123 4567"
                    />
                  </Field>
                </>
              )}
              <Field label="Notas" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  rows={2}
                  value={reserveForm.notes}
                  onChange={(e) => setReserveForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Condiciones del apartado, fecha límite, etc."
                />
              </Field>
              <div className="inv-modal__actions inv-field--span-all">
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setReserveModalOpen(false)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={submitting}>
                  {submitting ? "Guardando…" : "Registrar apartado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentModal && (
        <div className="inv-modal-overlay" onClick={() => !submitting && setPaymentModal(null)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">Registrar abono</h3>
            <p className="inv-dash__muted">Pendiente: {formatPrice(paymentModal.amount_due)}</p>
            {paymentModal.reservation_status === "active" && Number(paymentModal.amount_due) > 0 && (
              <p className="inv-dash__muted" style={{ marginTop: 0 }}>
                Apartado activo: tras cubrir el saldo usa <strong>Completar</strong> para cerrar la venta.
              </p>
            )}
            <form onSubmit={handleAddPayment} className="inv-modal-form">
              <Field label="Método">
                <PaymentMethodSelect
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((s) => ({ ...s, method: e.target.value }))}
                  groups={ABONO_PAYMENT_GROUPS}
                />
              </Field>

              {!isPaymentMixto && (
                <Field label="Monto *">
                  <CurrencyInput
                    value={paymentForm.amount}
                    onChange={(amount) => setPaymentForm((s) => ({ ...s, amount }))}
                    required
                  />
                </Field>
              )}

              {isPaymentMixto && (
                <div className="inv-field--span-all">
                  <p className="inv-field__label">Pagos mixtos (mínimo 2 métodos de contado)</p>
                  {paymentMixedPayments.map((p, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <PaymentMethodSelect
                        value={p.method}
                        onChange={(e) => setPaymentMixedPayments((rows) => rows.map((r, i) => (i === idx ? { ...r, method: e.target.value } : r)))}
                        groups={IMMEDIATE_PAYMENT_GROUPS}
                      />
                      <CurrencyInput
                        placeholder="$ 0"
                        value={p.amount}
                        onChange={(amount) => setPaymentMixedPayments((rows) => rows.map((r, i) => (i === idx ? { ...r, amount } : r)))}
                      />
                      {paymentMixedPayments.length > 2 && (
                        <button
                          type="button"
                          className="inv-btn inv-btn--ghost"
                          onClick={() => setPaymentMixedPayments((rows) => rows.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="inv-btn inv-btn--outline inv-btn--compact"
                    onClick={() => setPaymentMixedPayments((rows) => [...rows, { ...EMPTY_MIXED_PAYMENT }])}
                  >
                    + Agregar pago
                  </button>
                  <p className="inv-dash__muted" style={{ marginTop: "0.5rem" }}>
                    Total abono: {formatPrice(paymentMixedTotal)}
                    {paymentMixedTotal > 0 && paymentMixedTotal < Number(paymentModal.amount_due) && (
                      <> · Quedará pendiente: {formatPrice(Number(paymentModal.amount_due) - paymentMixedTotal)}</>
                    )}
                    {paymentMixedTotal > Number(paymentModal.amount_due) && (
                      <> · Supera el saldo pendiente</>
                    )}
                  </p>
                </div>
              )}

              <div className="inv-modal__actions">
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setPaymentModal(null)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={submitting}>
                  Guardar abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cashModalOpen && (
        <div className="inv-modal-overlay" onClick={() => !submitting && setCashModalOpen(false)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">
              {cashForm.type === "egreso" ? "Registrar egreso" : "Registrar ingreso"}
            </h3>
            <p className="inv-dash__muted" style={{ marginTop: 0 }}>
              Quedará en el cuadre de caja con origen Manual.
            </p>
            <form onSubmit={handleCashSubmit} className="inv-modal-form">
              <Field label="Tipo">
                <select
                  className="inv-field__input"
                  value={cashForm.type}
                  onChange={(e) => setCashForm((s) => ({ ...s, type: e.target.value }))}
                >
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
              </Field>
              <Field label="Monto">
                <CurrencyInput
                  value={cashForm.amount}
                  onChange={(v) => setCashForm((s) => ({ ...s, amount: v }))}
                  required
                />
              </Field>
              <Field label="Método">
                <PaymentMethodSelect
                  value={cashForm.method}
                  onChange={(e) => setCashForm((s) => ({ ...s, method: e.target.value }))}
                  groups={IMMEDIATE_PAYMENT_GROUPS}
                />
              </Field>
              <Field label="Concepto">
                <input
                  className="inv-field__input"
                  value={cashForm.concept}
                  onChange={(e) => setCashForm((s) => ({ ...s, concept: e.target.value }))}
                  placeholder="Ej. Abono proveedor, ajuste de caja…"
                />
              </Field>
              <Field label="Fecha">
                <input
                  type="date"
                  className="inv-field__input"
                  value={cashForm.occurred_at}
                  onChange={(e) => setCashForm((s) => ({ ...s, occurred_at: e.target.value }))}
                />
              </Field>
              <Field label="Notas">
                <textarea
                  className="inv-field__input"
                  rows={2}
                  value={cashForm.notes}
                  onChange={(e) => setCashForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </Field>
              <div className="inv-modal__actions">
                <button type="button" className="inv-btn inv-btn--ghost" onClick={() => setCashModalOpen(false)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="inv-btn inv-btn--primary" disabled={submitting}>
                  {submitting ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {customerModalOpen && (
        <CustomerCatalogModal
          open={customerModalOpen}
          onClose={() => setCustomerModalOpen(false)}
          onUpdated={handleCustomersUpdated}
        />
      )}

      {toast && <div className={`inv-toast inv-toast--${toast.type}`}>{toast.text}</div>}
    </div>
  );
}

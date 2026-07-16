import { clearInventarioCache } from "./inventarioCache.js";

const rawUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api").trim().replace(/\/$/, "");
const TOKEN_KEY = "phonecolombia_admin_token";
const USER_KEY = "phonecolombia_admin_user";

export const isApiConfigured = Boolean(rawUrl);

const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};

export function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(USER_KEY);
  }
}

function bootstrapQuery(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
  ).toString();
  return qs ? `?${qs}` : "";
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

const inflightGet = new Map();

async function requestOnce(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(`${rawUrl}${path}`, { ...options, headers, body });
  const data = await parseResponse(res);

  if (!res.ok) {
    const validationMsg = data?.errors
      ? Object.values(data.errors).flat().filter(Boolean).join(" ")
      : null;
    const message =
      validationMsg ||
      data?.message ||
      `Error ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET") {
    return requestOnce(path, options);
  }

  if (inflightGet.has(path)) {
    return inflightGet.get(path);
  }

  const promise = requestOnce(path, options).finally(() => {
    inflightGet.delete(path);
  });
  inflightGet.set(path, promise);
  return promise;
}

export const api = {
  isConfigured: isApiConfigured,
  getToken,
  clearToken,

  async login(email, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (data?.token) setToken(data.token);
    if (data?.user) setStoredUser(data.user);
    return data;
  },

  async logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      clearToken();
      clearInventarioCache();
    }
  },

  async me() {
    const user = await request("/auth/me");
    setStoredUser(user);
    return user;
  },

  async bootstrapDashboard() {
    return request("/bootstrap/dashboard");
  },

  async bootstrapInventory(params = {}) {
    return request(`/bootstrap/inventory${bootstrapQuery(params)}`);
  },

  async bootstrapSales(params = {}) {
    return request(`/bootstrap/sales${bootstrapQuery(params)}`);
  },

  async bootstrapServiceTickets(params = {}) {
    return request(`/bootstrap/service-tickets${bootstrapQuery(params)}`);
  },

  async bootstrapReports(params = {}) {
    return request(`/bootstrap/reports${bootstrapQuery(params)}`);
  },

  async getProducts() {
    return request("/products");
  },

  async createProduct({ name, price, description, images }) {
    const form = new FormData();
    form.append("name", name);
    if (price) form.append("price", price);
    if (description) form.append("description", description);
    Array.from(images || []).forEach((file) => form.append("images[]", file));
    return request("/products", { method: "POST", body: form });
  },

  async updateProduct(id, { name, price, description, images }) {
    const form = new FormData();
    form.append("_method", "PUT");
    if (name !== undefined) form.append("name", name);
    if (price !== undefined) form.append("price", price);
    if (description !== undefined) form.append("description", description);
    if (images?.length) {
      Array.from(images).forEach((file) => form.append("images[]", file));
    }
    return request(`/products/${id}`, { method: "POST", body: form });
  },

  async deleteProduct(id) {
    return request(`/products/${id}`, { method: "DELETE" });
  },

  async getPromociones({ ascending = false } = {}) {
    const query = ascending ? "?asc=1" : "";
    return request(`/promociones${query}`);
  },

  async createPromocion({ nombre, precio, bundle, alt, imagen }) {
    const form = new FormData();
    form.append("nombre", nombre);
    form.append("precio", precio);
    form.append("bundle", bundle);
    if (alt) form.append("alt", alt);
    form.append("imagen", imagen);
    return request("/promociones", { method: "POST", body: form });
  },

  async deletePromocion(id) {
    return request(`/promociones/${id}`, { method: "DELETE" });
  },

  async getTestimonios() {
    return request("/testimonios");
  },

  async createTestimonio({ caption, video }) {
    const form = new FormData();
    if (caption) form.append("caption", caption);
    form.append("video", video);
    return request("/testimonios", { method: "POST", body: form });
  },

  async updateTestimonio(id, { caption, video }) {
    const form = new FormData();
    form.append("_method", "PUT");
    if (caption !== undefined) form.append("caption", caption);
    if (video) form.append("video", video);
    return request(`/testimonios/${id}`, { method: "POST", body: form });
  },

  async deleteTestimonio(id) {
    return request(`/testimonios/${id}`, { method: "DELETE" });
  },

  async getSetting(key) {
    return request(`/settings/${key}`);
  },

  async upsertSetting(key, value) {
    return request(`/settings/${key}`, {
      method: "PUT",
      body: { value },
    });
  },

  async uploadHeroVideo(file) {
    const form = new FormData();
    form.append("video", file);
    return request("/settings/hero_video_url", { method: "POST", body: form });
  },

  async getDeviceColors() {
    return request("/device-colors");
  },

  async createDeviceColor(name) {
    return request("/device-colors", {
      method: "POST",
      body: { name },
    });
  },

  async updateDeviceColor(id, name) {
    return request(`/device-colors/${id}`, {
      method: "PUT",
      body: { name },
    });
  },

  async deleteDeviceColor(id) {
    return request(`/device-colors/${id}`, { method: "DELETE" });
  },

  async getDeviceBrands() {
    return request("/device-brands");
  },

  async createDeviceBrand(name) {
    return request("/device-brands", {
      method: "POST",
      body: { name },
    });
  },

  async updateDeviceBrand(id, name) {
    return request(`/device-brands/${id}`, {
      method: "PUT",
      body: { name },
    });
  },

  async deleteDeviceBrand(id) {
    return request(`/device-brands/${id}`, { method: "DELETE" });
  },

  async getSuppliers() {
    return request("/suppliers");
  },

  async createSupplier(data) {
    return request("/suppliers", {
      method: "POST",
      body: data,
    });
  },

  async updateSupplier(id, data) {
    return request(`/suppliers/${id}`, {
      method: "PUT",
      body: data,
    });
  },

  async deleteSupplier(id) {
    return request(`/suppliers/${id}`, { method: "DELETE" });
  },

  async getInventoryProducts() {
    return request("/inventory/products");
  },

  async createInventoryProduct(data) {
    return request("/inventory/products", {
      method: "POST",
      body: data,
    });
  },

  async updateInventoryProduct(id, data) {
    return request(`/inventory/products/${id}`, {
      method: "PUT",
      body: data,
    });
  },

  async deleteInventoryProduct(id) {
    return request(`/inventory/products/${id}`, { method: "DELETE" });
  },

  async getInventory({ q, status, category, barcode, imei, identifier, exclude_status, archived } = {}) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (barcode) params.set("barcode", barcode);
    if (imei) params.set("imei", imei);
    if (identifier) params.set("identifier", identifier);
    if (exclude_status) params.set("exclude_status", exclude_status);
    if (archived) params.set("archived", "1");
    const query = params.toString();
    return request(`/inventory${query ? `?${query}` : ""}`);
  },

  async createInventoryItem(data) {
    return request("/inventory", { method: "POST", body: data });
  },

  async updateInventoryItem(id, data) {
    return request(`/inventory/${id}`, { method: "PUT", body: data });
  },

  async deleteInventoryItem(id) {
    return request(`/inventory/${id}`, { method: "DELETE" });
  },

  async retakeInventoryItem(id, data = {}) {
    return request(`/inventory/${id}/retake`, { method: "POST", body: data });
  },

  async getInventoryItem(id) {
    return request(`/inventory/${id}`);
  },

  async getInventorySummaryByModel(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/inventory/summary-by-model${qs ? `?${qs}` : ""}`);
  },

  async getDashboard() {
    return request("/dashboard");
  },

  async getSales(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/sales${qs ? `?${qs}` : ""}`);
  },

  async createSale(data) {
    return request("/sales", { method: "POST", body: data });
  },

  async updateSale(id, data) {
    return request(`/sales/${id}`, { method: "PUT", body: data });
  },

  async addSalePayment(saleId, data) {
    return request(`/sales/${saleId}/payments`, { method: "POST", body: data });
  },

  async getCashMovements(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/cash-movements${qs ? `?${qs}` : ""}`);
  },

  async createCashMovement(data) {
    return request("/cash-movements", { method: "POST", body: data });
  },

  async deleteCashMovement(id) {
    return request(`/cash-movements/${id}`, { method: "DELETE" });
  },

  async reserveInventoryItem(id, data) {
    return request(`/inventory/${id}/reserve`, { method: "POST", body: data });
  },

  async cancelInventoryReservation(id) {
    return request(`/inventory/${id}/cancel-reservation`, { method: "POST" });
  },

  async completeReservation(saleId, data) {
    return request(`/sales/${saleId}/complete-reservation`, { method: "POST", body: data });
  },

  async cancelReservation(saleId) {
    return request(`/sales/${saleId}/cancel-reservation`, { method: "POST" });
  },

  async getDailyReport(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/reports/daily${qs ? `?${qs}` : ""}`);
  },

  async getMonthlyReport(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/reports/monthly${qs ? `?${qs}` : ""}`);
  },

  async getCashRegisterReport(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/reports/cash-register${qs ? `?${qs}` : ""}`);
  },

  async getDailySettlementReport(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/reports/daily-settlement${qs ? `?${qs}` : ""}`);
  },

  async getReceivablesReport(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/reports/receivables${qs ? `?${qs}` : ""}`);
  },

  async getBySellerReport(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/reports/by-seller${qs ? `?${qs}` : ""}`);
  },

  async getByRemissionReport(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/reports/by-remission${qs ? `?${qs}` : ""}`);
  },

  async getInventoryIntakeReport(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/reports/inventory-intake${qs ? `?${qs}` : ""}`);
  },

  async getServiceTicketsReport(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/reports/service-tickets${qs ? `?${qs}` : ""}`);
  },

  async getCreditConfig() {
    return request("/credit-config");
  },

  async createCreditPaymentMethod(data) {
    return request("/credit-config/methods", { method: "POST", body: data });
  },

  async updateCreditPaymentMethod(id, data) {
    return request(`/credit-config/methods/${id}`, { method: "PUT", body: data });
  },

  async deleteCreditPaymentMethod(id) {
    return request(`/credit-config/methods/${id}`, { method: "DELETE" });
  },

  async updateCreditSettings(data) {
    return request("/credit-config/settings", { method: "PUT", body: data });
  },

  async getServiceTechnicians() {
    return request("/service-tickets/technicians");
  },

  async getServiceWorkshops() {
    return request("/service-tickets/workshops");
  },

  async getServiceCustomers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/service/customers${qs ? `?${qs}` : ""}`);
  },

  async createServiceCustomer(data) {
    return request("/service/customers", { method: "POST", body: data });
  },

  async updateServiceCustomer(id, data) {
    return request(`/service/customers/${id}`, { method: "PUT", body: data });
  },

  async deleteServiceCustomer(id) {
    return request(`/service/customers/${id}`, { method: "DELETE" });
  },

  async getServiceCategories(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/service/categories${qs ? `?${qs}` : ""}`);
  },

  async createServiceCategory(data) {
    return request("/service/categories", { method: "POST", body: data });
  },

  async updateServiceCategory(id, data) {
    return request(`/service/categories/${id}`, { method: "PUT", body: data });
  },

  async deleteServiceCategory(id) {
    return request(`/service/categories/${id}`, { method: "DELETE" });
  },

  async getServiceTicketStates(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/service/states${qs ? `?${qs}` : ""}`);
  },

  async createServiceTicketState(data) {
    return request("/service/states", { method: "POST", body: data });
  },

  async updateServiceTicketState(id, data) {
    return request(`/service/states/${id}`, { method: "PUT", body: data });
  },

  async deleteServiceTicketState(id) {
    return request(`/service/states/${id}`, { method: "DELETE" });
  },

  async getServiceTechniciansCatalog(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/service/technicians${qs ? `?${qs}` : ""}`);
  },

  async createServiceTechnician(data) {
    return request("/service/technicians", { method: "POST", body: data });
  },

  async updateServiceTechnician(id, data) {
    return request(`/service/technicians/${id}`, { method: "PUT", body: data });
  },

  async deleteServiceTechnician(id) {
    return request(`/service/technicians/${id}`, { method: "DELETE" });
  },

  async getServiceTickets(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/service-tickets${qs ? `?${qs}` : ""}`);
  },

  async createServiceTicket(data) {
    return request("/service-tickets", { method: "POST", body: data });
  },

  async updateServiceTicket(id, data) {
    return request(`/service-tickets/${id}`, { method: "PUT", body: data });
  },

  async getAuditLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/audit-logs${qs ? `?${qs}` : ""}`);
  },

  async getImportTemplate() {
    return request("/inventory/import/template");
  },

  async importInventory(file) {
    const form = new FormData();
    form.append("file", file);
    return request("/inventory/import", { method: "POST", body: form });
  },

  exportInventoryUrl() {
    return `${rawUrl}/inventory/export`;
  },

  exportSalesUrl(from, to) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return `${rawUrl}/reports/export/sales${qs ? `?${qs}` : ""}`;
  },

  exportDailyReportPdfUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/daily/export/pdf${qs ? `?${qs}` : ""}`;
  },

  exportDailyReportExcelUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/daily/export/xlsx${qs ? `?${qs}` : ""}`;
  },

  exportBySellerReportPdfUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/by-seller/export/pdf${qs ? `?${qs}` : ""}`;
  },

  exportBySellerReportExcelUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/by-seller/export/xlsx${qs ? `?${qs}` : ""}`;
  },

  exportCashRegisterReportPdfUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/cash-register/export/pdf${qs ? `?${qs}` : ""}`;
  },

  exportCashRegisterReportExcelUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/cash-register/export/xlsx${qs ? `?${qs}` : ""}`;
  },

  exportDailySettlementReportPdfUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/daily-settlement/export/pdf${qs ? `?${qs}` : ""}`;
  },

  exportDailySettlementReportExcelUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/daily-settlement/export/xlsx${qs ? `?${qs}` : ""}`;
  },

  exportReceivablesReportPdfUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/receivables/export/pdf${qs ? `?${qs}` : ""}`;
  },

  exportReceivablesReportExcelUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/receivables/export/xlsx${qs ? `?${qs}` : ""}`;
  },

  exportByRemissionReportXlsUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/by-remission/export/xls${qs ? `?${qs}` : ""}`;
  },

  exportByRemissionReportPdfUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/by-remission/export/pdf${qs ? `?${qs}` : ""}`;
  },

  exportInventoryIntakeReportPdfUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/inventory-intake/export/pdf${qs ? `?${qs}` : ""}`;
  },

  exportInventoryIntakeReportExcelUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/inventory-intake/export/xlsx${qs ? `?${qs}` : ""}`;
  },

  exportServiceTicketsReportPdfUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/service-tickets/export/pdf${qs ? `?${qs}` : ""}`;
  },

  exportServiceTicketsReportExcelUrl(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return `${rawUrl}/reports/service-tickets/export/xlsx${qs ? `?${qs}` : ""}`;
  },

  exportRemissionPdfUrl(saleId) {
    return `${rawUrl}/sales/${saleId}/remission/pdf`;
  },

  async getRemissionDocument(saleId) {
    return request(`/sales/${saleId}/remission`);
  },

  async downloadAuthenticated(url, filename) {
    const token = getToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  async getUsers() {
    return request("/users");
  },

  async createUser(data) {
    return request("/users", { method: "POST", body: data });
  },

  async updateUser(id, data) {
    return request(`/users/${id}`, { method: "PUT", body: data });
  },

  async deleteUser(id) {
    return request(`/users/${id}`, { method: "DELETE" });
  },
};

export default api;

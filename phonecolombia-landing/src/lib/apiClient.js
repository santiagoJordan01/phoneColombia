const rawUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api").trim().replace(/\/$/, "");
const TOKEN_KEY = "phonecolombia_admin_token";

export const isApiConfigured = Boolean(rawUrl);

const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function request(path, options = {}) {
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
    return data;
  },

  async logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      clearToken();
    }
  },

  async me() {
    return request("/auth/me");
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

  async deleteDeviceColor(id) {
    return request(`/device-colors/${id}`, { method: "DELETE" });
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

  async getInventory({ q, status, category } = {}) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
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
};

export default api;

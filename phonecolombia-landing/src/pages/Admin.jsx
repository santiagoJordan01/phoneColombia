import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import api, { isApiConfigured } from "../lib/apiClient";
import { canAccessContent, canAccessInventory, getDefaultInventarioPath, isServiceTechnician } from "./inventario/shared.jsx";
import "../styles.css";

export default function Admin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("productos");

  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({ name: "", price: "", description: "" });
  const [productFiles, setProductFiles] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProductImages, setEditingProductImages] = useState([]);
  const [password, setPassword] = useState("");

  const [promociones, setPromociones] = useState([]);
  const [promoForm, setPromoForm] = useState({ nombre: "", precio: "", bundle: "", alt: "" });
  const [promoFile, setPromoFile] = useState(null);

  const [testimonios, setTestimonios] = useState([]);
  const [testimonioForm, setTestimonioForm] = useState({ caption: "" });
  const [testimonioFile, setTestimonioFile] = useState(null);
  const [editingTestimonioId, setEditingTestimonioId] = useState(null);

  const [heroFile, setHeroFile] = useState(null);
  const [heroUrl, setHeroUrl] = useState(null);
  const [heroLoading, setHeroLoading] = useState(false);

  const [garantias, setGarantias] = useState([]);
  const [garantiasLoading, setGarantiasLoading] = useState(false);

  if (!isApiConfigured) {
    return (
      <div className="container admin-page">
        <h2>Panel Admin — API no configurada</h2>
        <p>
          Define <code>VITE_API_URL</code> en tu archivo <code>.env</code> (por ejemplo{" "}
          <code>http://localhost:8000/api</code>) y reinicia el servidor de desarrollo.
        </p>
      </div>
    );
  }

  useEffect(() => {
    (async () => {
      if (!api.getToken()) return;
      try {
        const me = await api.me();
        setUser(me);
        if (isServiceTechnician(me)) {
          navigate("/admin/inventario/servicio-tecnico");
        } else if (canAccessInventory(me) && !canAccessContent(me)) {
          navigate(getDefaultInventarioPath(me));
        }
      } catch {
        api.clearToken();
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (user && canAccessContent(user)) {
      fetchProducts();
      fetchPromociones();
      fetchTestimonios();
      fetchHero();
      fetchGarantias();
    }
  }, [user]);

  const fetchGarantias = async () => {
    try {
      setGarantiasLoading(true);
      const data = await api.getSetting("garantias");
      if (data?.value) {
        const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        setGarantias(Array.isArray(parsed) ? parsed : []);
      } else {
        setGarantias([]);
      }
    } catch {
      setGarantias([]);
    } finally {
      setGarantiasLoading(false);
    }
  };

  const addGarantia = () => {
    setGarantias((prev) => [...prev, { title: "Nueva garantía", text1: "", text2: "" }]);
  };

  const updateGarantia = (idx, field, value) => {
    setGarantias((prev) => prev.map((g, i) => (i === idx ? { ...g, [field]: value } : g)));
  };

  const deleteGarantia = (idx) => {
    if (!confirm("Eliminar garantía?")) return;
    setGarantias((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveGarantias = async () => {
    setGarantiasLoading(true);
    try {
      await api.upsertSetting("garantias", garantias);
      setMessage("✅ Garantías guardadas");
    } catch (e) {
      setMessage("Error guardando garantías: " + (e.message || String(e)));
    } finally {
      setGarantiasLoading(false);
    }
  };

  const fetchHero = async () => {
    try {
      const data = await api.getSetting("hero_video_url");
      if (data?.value) setHeroUrl(data.value);
    } catch {
      // ignore
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts();
      setProducts(data || []);
    } catch (e) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (editingProductId) {
        await api.updateProduct(editingProductId, {
          name: productForm.name,
          price: productForm.price,
          description: productForm.description,
          images: productFiles,
        });
        setMessage("✅ Producto actualizado correctamente");
      } else {
        if (!productFiles || productFiles.length === 0) {
          setMessage("⚠️ Debes seleccionar al menos una imagen");
          setLoading(false);
          return;
        }
        await api.createProduct({
          ...productForm,
          images: productFiles,
        });
        setMessage("✅ Producto creado correctamente");
      }

      resetProductForm();
      fetchProducts();
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm("¿Eliminar producto?")) return;
    setLoading(true);
    try {
      await api.deleteProduct(id);
      fetchProducts();
    } catch (e) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  const startEditProduct = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name || "",
      price: product.price || "",
      description: product.description || "",
    });
    setEditingProductImages(product.images || []);
    setProductFiles(null);
    setEditModalOpen(true);
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductForm({ name: "", price: "", description: "" });
    setProductFiles(null);
    setEditingProductImages([]);
    setEditModalOpen(false);
  };

  const fetchPromociones = async () => {
    setLoading(true);
    try {
      const data = await api.getPromociones();
      setPromociones(data || []);
    } catch (e) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  const fetchTestimonios = async () => {
    setLoading(true);
    try {
      const data = await api.getTestimonios();
      setTestimonios(data || []);
    } catch (e) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  const handleTestimonioSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (testimonioFile) {
        const isMp4Mime = testimonioFile.type === "video/mp4";
        const isMp4Ext = String(testimonioFile.name).toLowerCase().endsWith(".mp4");
        if (!isMp4Mime && !isMp4Ext) {
          setMessage("Formato no permitido: usa .mp4 (H.264) para asegurar compatibilidad en navegadores.");
          setLoading(false);
          return;
        }
      }

      if (editingTestimonioId) {
        await api.updateTestimonio(editingTestimonioId, {
          caption: testimonioForm.caption,
          video: testimonioFile || undefined,
        });
        setMessage("✅ Testimonio actualizado");
      } else {
        if (!testimonioFile) {
          setMessage("⚠️ Selecciona un video");
          setLoading(false);
          return;
        }
        await api.createTestimonio({
          caption: testimonioForm.caption,
          video: testimonioFile,
        });
        setMessage("✅ Testimonio creado");
      }

      resetTestimonioForm();
      fetchTestimonios();
    } catch (err) {
      setMessage(`❌ Error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditTestimonio = (t) => {
    setEditingTestimonioId(t.id);
    setTestimonioForm({ caption: t.caption || "" });
    setTestimonioFile(null);
  };

  const resetTestimonioForm = () => {
    setEditingTestimonioId(null);
    setTestimonioForm({ caption: "" });
    setTestimonioFile(null);
  };

  const deleteTestimonio = async (id) => {
    if (!confirm("¿Eliminar testimonio?")) return;
    setLoading(true);
    try {
      await api.deleteTestimonio(id);
      setMessage("Testimonio eliminado");
      fetchTestimonios();
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const createPromocion = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createPromocion({ ...promoForm, imagen: promoFile });
      setMessage("Promoción creada");
      setPromoForm({ nombre: "", precio: "", bundle: "", alt: "" });
      setPromoFile(null);
      fetchPromociones();
    } catch (e) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  const deletePromocion = async (id) => {
    if (!confirm("¿Eliminar promoción?")) return;
    setLoading(true);
    try {
      await api.deletePromocion(id);
      fetchPromociones();
    } catch (e) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  const signIn = async () => {
    setMessage("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return setMessage("Ingresa email y contraseña");
    setLoading(true);
    try {
      const data = await api.login(trimmedEmail, password);
      setUser(data.user);
      setMessage("Sesión iniciada");
      if (data.user && isServiceTechnician(data.user)) {
        navigate("/admin/inventario/servicio-tecnico");
      } else if (data.user && canAccessInventory(data.user) && !canAccessContent(data.user)) {
        navigate(getDefaultInventarioPath(data.user));
      }
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await api.logout();
    setUser(null);
    setProducts([]);
    setPromociones([]);
    setTestimonios([]);
  };

  if (!user) {
    return (
      <div className="container admin-login-wrapper">
        <div className="admin-login-card" role="region" aria-label="Login administrador">
          <div className="admin-login-brand">
            <div className="admin-logo">
              <img src={`${import.meta.env.BASE_URL}imagenes/logo-blanco-rojo.jfif`} alt="Phone Colombia Logo" className="imagenLogo" />
            </div>
            <div>
              <h2 style={{ margin: 0 }}>Panel Admin</h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: "0.95rem" }}>Ingresa tus credenciales</p>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); signIn(); }} className="admin-login-form" style={{ display: "grid", gap: "0.65rem" }}>
            <input
              className="admin-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              required
              autoComplete="email"
            />
            <input
              className="admin-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              required
              autoComplete="current-password"
            />

            <div className="admin-actions">
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Iniciando..." : "Iniciar sesión"}</button>
            </div>
          </form>

          {message && <p className="admin-login-message">{message}</p>}
        </div>
      </div>
    );
  }

  if (!canAccessContent(user)) {
    if (isServiceTechnician(user)) {
      return <Navigate to="/admin/inventario/servicio-tecnico" replace />;
    }
    if (canAccessInventory(user)) {
      return <Navigate to={getDefaultInventarioPath(user)} replace />;
    }
    return (
      <div className="container admin-page">
        <p>Tu cuenta no tiene acceso al panel de gestión de contenido.</p>
        <button type="button" className="btn-secondary" onClick={signOut}>Cerrar sesión</button>
      </div>
    );
  }

  return (
    <div className="container admin-page">
      <header className="admin-header">
        <h2 className="admin-title">Panel Admin — Gestión de contenido</h2>
        <div className="admin-actions admin-actions--split">
          {canAccessInventory(user) && (
            <Link to="/admin/inventario" className="btn-secondary btn-admin-nav">Inventario</Link>
          )}
          <button type="button" className="btn-secondary btn-logout" onClick={signOut}>Cerrar sesión</button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Secciones del panel">
        <button type="button" onClick={() => setActiveTab("productos")} className={`admin-tab ${activeTab === "productos" ? "active" : ""}`}>Productos</button>
        <button type="button" onClick={() => setActiveTab("promociones")} className={`admin-tab ${activeTab === "promociones" ? "active" : ""}`}>Promociones</button>
        <button type="button" onClick={() => setActiveTab("testimonios")} className={`admin-tab ${activeTab === "testimonios" ? "active" : ""}`}>Testimonios</button>
        <button type="button" onClick={() => setActiveTab("hero")} className={`admin-tab ${activeTab === "hero" ? "active" : ""}`}>Hero</button>
        <button type="button" onClick={() => setActiveTab("garantias")} className={`admin-tab ${activeTab === "garantias" ? "active" : ""}`}>Garantías</button>
      </nav>

      {activeTab === "productos" && (
        <>
          <section className="admin-section">
            <h3>{editingProductId ? "Editar producto" : "Crear nuevo producto"}</h3>
            {editingProductId && (
              <p className="admin-edit-hint">
                Editando ID: {editingProductId}
                <button type="button" onClick={resetProductForm} className="admin-cancel-link">Cancelar edición</button>
              </p>
            )}
            <form onSubmit={handleProductSubmit} className="admin-form">
              <input className="admin-input" placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm((s) => ({ ...s, name: e.target.value }))} required />
              <input className="admin-input" placeholder="Precio" value={productForm.price} onChange={(e) => setProductForm((s) => ({ ...s, price: e.target.value }))} required />
              <textarea className="admin-input" placeholder="Descripción" value={productForm.description} onChange={(e) => setProductForm((s) => ({ ...s, description: e.target.value }))} rows={3} />
              <input className="admin-input" type="file" multiple accept="image/*" onChange={(e) => setProductFiles(e.target.files)} />
              {editingProductId && (
                <p style={{ fontSize: "0.8rem", color: "#aaa" }}>Si no seleccionas nuevas imágenes, se conservarán las actuales.</p>
              )}
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : editingProductId ? "Actualizar producto" : "Crear producto"}</button>
            </form>
          </section>

          {editModalOpen && (
            <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-label="Editar producto">
              <div className="admin-modal">
                <div className="admin-modal-header">
                  <h3 style={{ margin: 0 }}>Editar producto</h3>
                  <button type="button" onClick={resetProductForm} className="admin-modal-close" aria-label="Cerrar">✖</button>
                </div>

                <form onSubmit={handleProductSubmit} className="admin-form">
                  <input className="admin-input" placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm((s) => ({ ...s, name: e.target.value }))} required />
                  <input className="admin-input" placeholder="Precio" value={productForm.price} onChange={(e) => setProductForm((s) => ({ ...s, price: e.target.value }))} required />
                  <textarea className="admin-input" placeholder="Descripción" value={productForm.description} onChange={(e) => setProductForm((s) => ({ ...s, description: e.target.value }))} rows={3} />

                  <div className="admin-image-preview-grid">
                    {editingProductImages?.length > 0 ? (
                      editingProductImages.map((src, idx) => (
                        <img key={idx} src={src} alt={`preview-${idx}`} />
                      ))
                    ) : (
                      <span style={{ color: "#aaa", fontSize: "0.85rem" }}>Sin imágenes actuales</span>
                    )}
                  </div>

                  <label style={{ fontSize: "0.85rem", color: "#aaa" }}>Subir nuevas imágenes (opcional)</label>
                  <input className="admin-input" type="file" multiple accept="image/*" onChange={(e) => setProductFiles(e.target.files)} />

                  <div className="admin-modal-actions">
                    <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : "Actualizar producto"}</button>
                    <button type="button" className="btn-secondary" onClick={resetProductForm}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <section className="admin-list-section">
            <h3>Productos ({products.length})</h3>
            {loading && <p>Cargando...</p>}
            <div className="admin-grid">
              {products.map((p) => (
                <div key={p.id} className="producto-card">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name || "imagen"} className="producto-imagen" />
                  ) : (
                    <div className="producto-imagen producto-imagen--placeholder" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span>Sin imagen</span>
                    </div>
                  )}
                  <strong style={{ color: "#fff" }}>{p.name}</strong>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ color: "rgba(255,255,255,0.9)" }}>{p.description}</div>
                    <div style={{ marginTop: 6, fontWeight: 800 }}>${p.price}</div>
                  </div>
                  <div className="admin-card-actions">
                    <button type="button" className="btn-secondary" onClick={() => deleteProduct(p.id)}>Eliminar</button>
                    <button type="button" className="btn-secondary" onClick={() => startEditProduct(p)}>Editar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === "promociones" && (
        <>
          <section className="admin-section">
            <h3>Crear nueva promoción</h3>
            <form onSubmit={createPromocion} className="admin-form">
              <input className="admin-input" placeholder="Nombre (ej: SUPER PROMO)" value={promoForm.nombre} onChange={(e) => setPromoForm((s) => ({ ...s, nombre: e.target.value }))} required />
              <input className="admin-input" placeholder="Precio (ej: 0.000.000)" value={promoForm.precio} onChange={(e) => setPromoForm((s) => ({ ...s, precio: e.target.value }))} required />
              <input className="admin-input" placeholder="Bundle (ej: CASE · CARGADOR · VIDRIO)" value={promoForm.bundle} onChange={(e) => setPromoForm((s) => ({ ...s, bundle: e.target.value }))} required />
              <input className="admin-input" placeholder="Texto alternativo (alt)" value={promoForm.alt} onChange={(e) => setPromoForm((s) => ({ ...s, alt: e.target.value }))} />
              <input className="admin-input" type="file" accept="image/*" onChange={(e) => setPromoFile(e.target.files[0])} required />
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : "Crear promoción"}</button>
            </form>
          </section>

          <section className="admin-list-section">
            <h3>Promociones ({promociones.length})</h3>
            {loading && <p>Cargando...</p>}
            <div className="admin-grid">
              {promociones.map((promo) => (
                <div key={promo.id} className="promo-card">
                  <img src={promo.imagen_url} className="producto-imagen" alt={promo.alt || promo.nombre} />
                  <h4 style={{ color: "#fff", margin: "0.5rem 0" }}>{promo.nombre}</h4>
                  <p style={{ color: "#ccc", fontSize: "0.9rem" }}>{promo.bundle}</p>
                  <p style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fcd901" }}>${promo.precio}</p>
                  <div className="admin-card-actions">
                    <button type="button" className="btn-secondary" onClick={() => deletePromocion(promo.id)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === "testimonios" && (
        <>
          <section className="admin-section">
            <h3>{editingTestimonioId ? "Editar testimonio" : "Crear nuevo testimonio"}</h3>
            {editingTestimonioId && (
              <p className="admin-edit-hint">
                Editando testimonio
                <button type="button" onClick={resetTestimonioForm} className="admin-cancel-link">Cancelar edición</button>
              </p>
            )}
            <form onSubmit={handleTestimonioSubmit} className="admin-form">
              <input className="admin-input" placeholder="Caption (opcional)" value={testimonioForm.caption} onChange={(e) => setTestimonioForm((s) => ({ ...s, caption: e.target.value }))} />
              <input className="admin-input" type="file" accept="video/*" onChange={(e) => setTestimonioFile(e.target.files[0])} />
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : editingTestimonioId ? "Actualizar testimonio" : "Crear testimonio"}</button>
            </form>
          </section>

          <section className="admin-list-section">
            <h3>Testimonios ({testimonios.length})</h3>
            {loading && <p>Cargando...</p>}
            <div className="admin-grid">
              {testimonios.map((t) => (
                <div key={t.id} className="promo-card">
                  <video src={t.video_url && encodeURI(t.video_url)} controls className="testimonio-video" />
                  <p style={{ color: "#ccc", minHeight: 32 }}>{t.caption}</p>
                  <div className="admin-card-actions admin-card-actions--row">
                    <button type="button" className="btn-secondary" onClick={() => startEditTestimonio(t)}>Editar</button>
                    <button type="button" className="btn-secondary" onClick={() => deleteTestimonio(t.id)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === "hero" && (
        <section className="admin-section">
          <h3>Video Hero</h3>
          <p style={{ color: "#ccc" }}>Sube el video que se mostrará en la sección principal.</p>
          <div className="admin-hero-controls">
            <input type="file" accept="video/*" className="admin-input" onChange={(e) => setHeroFile(e.target.files[0])} />
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                if (!heroFile) return setMessage("Selecciona un archivo");
                setHeroLoading(true);
                setMessage("Subiendo video del hero...");
                try {
                  const data = await api.uploadHeroVideo(heroFile);
                  setHeroUrl(data.value);
                  setMessage("✅ Hero actualizado");
                } catch (err) {
                  setMessage(`Error: ${err.message || String(err)}`);
                } finally {
                  setHeroLoading(false);
                }
              }}
              disabled={heroLoading}
            >
              {heroLoading ? "Subiendo..." : "Subir Hero"}
            </button>
          </div>

          {heroUrl && (
            <div className="admin-hero-preview">
              <h4>Preview actual</h4>
              <video src={heroUrl} controls />
            </div>
          )}
        </section>
      )}

      {activeTab === "garantias" && (
        <section className="admin-section">
          <h3>Editar Garantías</h3>
          <p style={{ color: "#ccc" }}>Modifica los textos de garantías que se muestran en la página pública.</p>

          {garantiasLoading && <p>Cargando garantías...</p>}

          <div>
            {garantias?.length > 0 ? (
              garantias.map((g, idx) => (
                <div key={idx} className="admin-garantia-item">
                  <input className="admin-input" placeholder="Título" value={g.title} onChange={(e) => updateGarantia(idx, "title", e.target.value)} />
                  <textarea className="admin-input" placeholder="Texto principal" value={g.text1} onChange={(e) => updateGarantia(idx, "text1", e.target.value)} rows={3} />
                  <textarea className="admin-input" placeholder="Excepciones" value={g.text2} onChange={(e) => updateGarantia(idx, "text2", e.target.value)} rows={2} />
                  <div className="admin-garantia-actions">
                    <button type="button" className="btn-secondary" onClick={() => deleteGarantia(idx)}>Eliminar</button>
                  </div>
                </div>
              ))
            ) : (
              <p>No hay garantías definidas. Agrega una nueva.</p>
            )}

            <div className="admin-garantia-toolbar">
              <button type="button" className="btn-primary" onClick={addGarantia}>Agregar garantía</button>
              <button type="button" className="btn-primary" onClick={saveGarantias} disabled={garantiasLoading}>{garantiasLoading ? "Guardando..." : "Guardar garantías"}</button>
            </div>
          </div>
        </section>
      )}

      {message && <p className="admin-message" role="status">{message}</p>}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import "../styles.css";

export default function Admin() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("productos"); // 'productos' o 'promociones'

  // Estados para Productos
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({ name: "", price: "", description: "" });
  const [productFiles, setProductFiles] = useState(null);
  const [password, setPassword] = useState("");

  // Estados para Promociones
  const [promociones, setPromociones] = useState([]);
  const [promoForm, setPromoForm] = useState({ nombre: "", precio: "", bundle: "", alt: "" });
  const [promoFile, setPromoFile] = useState(null);

  if (!isSupabaseConfigured) {
    return (
      <div className="container" style={{ padding: "2rem" }}>
        <h2>Panel Admin — Supabase no configurado</h2>
        <p>Las variables de entorno de Supabase no están definidas. Crea un archivo <code>.env</code> en la raíz del proyecto con las claves:</p>
        <pre style={{ background: "#111", color: "#fff", padding: "0.6rem" }}>
          VITE_SUPABASE_URL=your-project-ref.supabase.co
          <br />
          VITE_SUPABASE_ANON_KEY=your-anon-key
        </pre>
        <p>Después reinicia el servidor de desarrollo (<code>npm run dev</code>).</p>
      </div>
    );
  }

  // Autenticación
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
      } catch (err) {}
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      try { listener?.subscription?.unsubscribe?.(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchPromociones();
    }
  }, [user]);

  // === Productos CRUD ===
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setProducts(data || []);
    setLoading(false);
  };

  const uploadProductImages = async (filesList) => {
    if (!filesList || filesList.length === 0) return [];
    const uploaded = [];
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const filePath = `products/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("products").upload(filePath, file);
      if (error) {
        setMessage(`Error subiendo ${file.name}: ${error.message}`);
        continue;
      }
      const { data: publicData } = supabase.storage.from("products").getPublicUrl(filePath);
      uploaded.push(publicData.publicUrl);
    }
    return uploaded;
  };

  const createProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    const images = await uploadProductImages(productFiles);
    const { error } = await supabase.from("products").insert([{ ...productForm, images }]);
    if (error) setMessage(error.message);
    else {
      setMessage("Producto creado");
      setProductForm({ name: "", price: "", description: "" });
      setProductFiles(null);
      fetchProducts();
    }
    setLoading(false);
  };

  const deleteProduct = async (id) => {
    if (!confirm("¿Eliminar producto?")) return;
    setLoading(true);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) setMessage(error.message);
    else fetchProducts();
    setLoading(false);
  };

  // === Promociones CRUD ===
  const fetchPromociones = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("promociones").select("*").order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setPromociones(data || []);
    setLoading(false);
  };

  const uploadPromoImage = async (file) => {
    if (!file) return null;
    const filePath = `promociones/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("promociones").upload(filePath, file);
    if (error) {
      setMessage(`Error subiendo imagen: ${error.message}`);
      return null;
    }
    const { data: publicData } = supabase.storage.from("promociones").getPublicUrl(filePath);
    return publicData.publicUrl;
  };

  const createPromocion = async (e) => {
    e.preventDefault();
    setLoading(true);
    const imagenUrl = await uploadPromoImage(promoFile);
    if (!imagenUrl) {
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("promociones").insert([{ ...promoForm, imagen_url: imagenUrl }]);
    if (error) setMessage(error.message);
    else {
      setMessage("Promoción creada");
      setPromoForm({ nombre: "", precio: "", bundle: "", alt: "" });
      setPromoFile(null);
      fetchPromociones();
    }
    setLoading(false);
  };

  const deletePromocion = async (id) => {
    if (!confirm("¿Eliminar promoción?")) return;
    setLoading(true);
    const { error } = await supabase.from("promociones").delete().eq("id", id);
    if (error) setMessage(error.message);
    else fetchPromociones();
    setLoading(false);
  };

  // Autenticación
  const signIn = async () => {
    setMessage("");
    if (!email || !password) return setMessage("Ingresa email y contraseña");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setMessage(error.message);

      // Intentar validar que el email esté en la tabla `admins` (si existe)
      try {
        const { data: admins, error: adminsError } = await supabase
          .from("admins")
          .select("id,email")
          .eq("email", email)
          .limit(1);

        if (adminsError) {
          // No bloquear el acceso si la tabla no existe o hay error, pero avisar
          setMessage("Sesión iniciada (no fue posible verificar administradores: " + adminsError.message + ").");
          return;
        }

        if (!admins || admins.length === 0) {
          // No autorizado
          await supabase.auth.signOut();
          return setMessage("Acceso no autorizado. Tu cuenta no está en la lista de administradores.");
        }

        setMessage("Sesión iniciada");
      } catch (e) {
        // fallback: permitir acceso pero informar
        setMessage("Sesión iniciada (no fue posible verificar administradores).");
      }
    } catch (err) {
      setLoading(false);
      setMessage(err.message || String(err));
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProducts([]);
    setPromociones([]);
  };

  if (!user) {
    return (
      <div className="container admin-login-wrapper" style={{ padding: "2rem" }}>
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

          <form
            onSubmit={(e) => { e.preventDefault(); signIn(); }}
            className="admin-login-form"
            style={{ display: "grid", gap: "0.65rem", marginTop: "0.6rem" }}
          >
            <input
              className="admin-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              required
            />
            <input
              className="admin-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              required
              onKeyDown={(e) => { if (e.key === 'Enter') signIn(); }}
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

  return (
    <div className="container admin-page" style={{ padding: "2rem" }}>
      <header className="admin-header">
        <h2 className="admin-title">Panel Admin — Gestión de contenido</h2>
        <div className="admin-actions">
          <button className="btn-secondary btn-logout" onClick={signOut}>Cerrar sesión</button>
        </div>
      </header>

      {/* Pestañas */}
      <div className="admin-tabs">
        <button onClick={() => setActiveTab("productos")} className={`admin-tab ${activeTab === "productos" ? "active" : ""}`}>Productos</button>
        <button onClick={() => setActiveTab("promociones")} className={`admin-tab ${activeTab === "promociones" ? "active" : ""}`}>Promociones</button>
      </div>

      {activeTab === "productos" && (
        <>
          <section className="admin-section" style={{ marginTop: "1rem" }}>
            <h3>Crear nuevo producto</h3>
            <form onSubmit={createProduct} className="admin-form">
              <input className="admin-input" placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm(s => ({ ...s, name: e.target.value }))} required />
              <input className="admin-input" placeholder="Precio" value={productForm.price} onChange={(e) => setProductForm(s => ({ ...s, price: e.target.value }))} required />
              <textarea className="admin-input" placeholder="Descripción" value={productForm.description} onChange={(e) => setProductForm(s => ({ ...s, description: e.target.value }))} />
              <input className="admin-input" type="file" multiple accept="image/*" onChange={(e) => setProductFiles(e.target.files)} />
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : "Crear producto"}</button>
            </form>
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h3>Productos ({products.length})</h3>
            {loading && <p>Cargando...</p>}
            <div className="productos-grid admin-grid" style={{ marginTop: "1rem" }}>
              {products.map(p => (
                <div key={p.id} className="producto-card" style={{ maxWidth: 320 }}>
                  {p.images && p.images[0] && <img src={p.images[0]} alt={p.name || "imagen"} className="producto-imagen" />}
                  <strong style={{ color: "#fff" }}>{p.name}</strong>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ color: "rgba(255,255,255,0.9)" }}>{p.description}</div>
                    <div style={{ marginTop: 6, fontWeight: 800 }}>${p.price}</div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button className="btn-secondary" onClick={() => deleteProduct(p.id)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === "promociones" && (
        <>
          <section className="admin-section" style={{ marginTop: "1rem" }}>
            <h3>Crear nueva promoción</h3>
            <form onSubmit={createPromocion} className="admin-form">
              <input className="admin-input" placeholder="Nombre (ej: SUPER PROMO)" value={promoForm.nombre} onChange={(e) => setPromoForm(s => ({ ...s, nombre: e.target.value }))} required />
              <input className="admin-input" placeholder="Precio (ej: 0.000.000)" value={promoForm.precio} onChange={(e) => setPromoForm(s => ({ ...s, precio: e.target.value }))} required />
              <input className="admin-input" placeholder="Bundle (ej: CASE · CARGADOR · VIDRIO)" value={promoForm.bundle} onChange={(e) => setPromoForm(s => ({ ...s, bundle: e.target.value }))} required />
              <input className="admin-input" placeholder="Texto alternativo (alt)" value={promoForm.alt} onChange={(e) => setPromoForm(s => ({ ...s, alt: e.target.value }))} />
              <input className="admin-input" type="file" accept="image/*" onChange={(e) => setPromoFile(e.target.files[0])} required />
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : "Crear promoción"}</button>
            </form>
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h3>Promociones ({promociones.length})</h3>
            {loading && <p>Cargando...</p>}
            <div className="admin-grid" style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", marginTop: "1rem" }}>
              {promociones.map(promo => (
                <div key={promo.id} className="promo-card" style={{ maxWidth: "280px", textAlign: "center" }}>
                  <img src={promo.imagen_url} alt={promo.alt || promo.nombre} style={{ width: "100%", borderRadius: "12px", marginBottom: "0.5rem" }} />
                  <h4 style={{ color: "#fff", margin: "0.5rem 0" }}>{promo.nombre}</h4>
                  <p style={{ color: "#ccc", fontSize: "0.9rem" }}>{promo.bundle}</p>
                  <p style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fcd901" }}>${promo.precio}</p>
                  <button className="btn-secondary" onClick={() => deletePromocion(promo.id)}>Eliminar</button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import "../styles.css";
if (typeof window !== 'undefined') window.supabase = supabase;

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
  const [editingProductId, setEditingProductId] = useState(null); // NUEVO: ID del producto en edición
  const [editModalOpen, setEditModalOpen] = useState(false); // NUEVO: mostrar modal de edición
  const [editingProductImages, setEditingProductImages] = useState([]); // NUEVO: imágenes actuales del producto en edición
  const [password, setPassword] = useState("");

  // Estados para Promociones
  const [promociones, setPromociones] = useState([]);
  const [promoForm, setPromoForm] = useState({ nombre: "", precio: "", bundle: "", alt: "" });
  const [promoFile, setPromoFile] = useState(null);
  // Estados para Testimonios (vídeos)
  const [testimonios, setTestimonios] = useState([]);
  const [testimonioForm, setTestimonioForm] = useState({ caption: "" });
  const [testimonioFile, setTestimonioFile] = useState(null);
  const [editingTestimonioId, setEditingTestimonioId] = useState(null);
  const [testimonioModalOpen, setTestimonioModalOpen] = useState(false);
  // Estado para el video del hero
  const [heroFile, setHeroFile] = useState(null);
  const [heroUrl, setHeroUrl] = useState(null);
  const [heroLoading, setHeroLoading] = useState(false);
  // Garantías (editable desde Admin)
  const [garantias, setGarantias] = useState([]);
  const [garantiasLoading, setGarantiasLoading] = useState(false);

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
      fetchTestimonios();
      fetchHero();
      fetchGarantias();
    }
  }, [user]);

  const fetchGarantias = async () => {
    try {
      setGarantiasLoading(true);
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'garantias').limit(1).maybeSingle();
      if (error) {
        console.warn('fetchGarantias error', error);
        setGarantias([]);
      } else if (data && data.value) {
        try {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (Array.isArray(parsed)) setGarantias(parsed);
          else setGarantias([]);
        } catch (e) {
          console.warn('No se pudo parsear garantias:', e);
          setGarantias([]);
        }
      } else {
        setGarantias([]);
      }
    } catch (e) {
      console.error('fetchGarantias exception', e);
      setGarantias([]);
    } finally {
      setGarantiasLoading(false);
    }
  };

  const addGarantia = () => {
    setGarantias(prev => [...prev, { title: 'Nueva garantía', text1: '', text2: '' }]);
  };

  const updateGarantia = (idx, field, value) => {
    setGarantias(prev => prev.map((g, i) => (i === idx ? { ...g, [field]: value } : g)));
  };

  const deleteGarantia = (idx) => {
    if (!confirm('Eliminar garantía?')) return;
    setGarantias(prev => prev.filter((_, i) => i !== idx));
  };

  const saveGarantias = async () => {
    setGarantiasLoading(true);
    try {
      const payload = JSON.stringify(garantias);
      const { data, error } = await supabase.from('site_settings').upsert([{ key: 'garantias', value: payload }]);
      if (error) {
        setMessage('Error guardando garantías: ' + (error.message || JSON.stringify(error)));
      } else {
        setMessage('✅ Garantías guardadas');
      }
    } catch (e) {
      setMessage('Error guardando garantías: ' + (e.message || String(e)));
    } finally {
      setGarantiasLoading(false);
    }
  };

  const fetchHero = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'hero_video_url').limit(1).maybeSingle();
      if (!error && data && data.value) {
        const v = data.value;
        if (/^https?:\/\//i.test(v)) {
          setHeroUrl(v);
        } else {
          const { data: publicData } = supabase.storage.from('hero').getPublicUrl(v);
          setHeroUrl(publicData?.publicUrl || v);
        }
      }
    } catch (e) {
      // ignore
    }
  };

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

  // Maneja creación y actualización de productos
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      let images = [];
      // Si se seleccionaron nuevas imágenes, las subimos
      if (productFiles && productFiles.length > 0) {
        images = await uploadProductImages(productFiles);
      }

      if (editingProductId) {
        // ----- MODO EDICIÓN -----
        const updateData = {
          name: productForm.name,
          price: productForm.price,
          description: productForm.description,
        };
        // Solo actualizar imágenes si se subieron nuevas
        if (images.length > 0) {
          updateData.images = images;
        }

        const { error } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", editingProductId);

        if (error) throw error;
        setMessage("✅ Producto actualizado correctamente");
      } else {
        // ----- MODO CREACIÓN -----
        if (images.length === 0) {
          setMessage("⚠️ Debes seleccionar al menos una imagen");
          setLoading(false);
          return;
        }
        const { error } = await supabase.from("products").insert([{ ...productForm, images }]);
        if (error) throw error;
        setMessage("✅ Producto creado correctamente");
      }

      // Limpiar formulario y salir del modo edición
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
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) setMessage(error.message);
    else fetchProducts();
    setLoading(false);
  };

  // Cargar producto en el formulario para editar
  const startEditProduct = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name || "",
      price: product.price || "",
      description: product.description || "",
    });
    // Guardar imágenes actuales para vista previa
    setEditingProductImages(product.images || []);
    // Las imágenes existentes no se cargan en el input file (por seguridad)
    setProductFiles(null);
    // Abrir modal de edición
    setEditModalOpen(true);
    // Opcional: hacer scroll (mejorar foco en modal)
    // document.querySelector('.admin-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Resetear formulario a modo creación
  const resetProductForm = () => {
    setEditingProductId(null);
    setProductForm({ name: "", price: "", description: "" });
    setProductFiles(null);
    setEditingProductImages([]);
    setEditModalOpen(false);
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

  // ========== TESTIMONIOS CRUD (vídeos) ==========
  const fetchTestimonios = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("testimonios").select("*").order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setTestimonios(data || []);
    setLoading(false);
  };

  const uploadTestimonioVideo = async (file) => {
    if (!file) return null;
    const sanitizeFileName = (name) => {
      if (!name) return "file";
      return name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-.]/g, "");
    };

    const safeName = sanitizeFileName(file.name);
    // Guardar dentro de una carpeta 'videos/' en el bucket para evitar repetir el nombre del bucket
    const filePath = `videos/${Date.now()}_${safeName}`;

    const { data, error } = await supabase.storage.from("testimonios").upload(filePath, file);
    if (error) {
      // Manejar error de bucket no existente con un mensaje claro
      if (error?.message?.toLowerCase()?.includes('bucket not found') || error?.status === 404) {
        setMessage('Error: el bucket "testimonios" no existe en Supabase Storage. Crea el bucket desde el dashboard y vuelve a intentarlo.');
        return null;
      }
      setMessage(`Error subiendo ${file.name}: ${error.message || JSON.stringify(error)}`);
      console.warn('uploadTestimonioVideo error', error);
      return null;
    }

    const { data: publicData } = supabase.storage.from("testimonios").getPublicUrl(filePath);
    try {
      return encodeURI(publicData.publicUrl);
    } catch {
      return publicData.publicUrl;
    }
  };

  // Helper: extrae la ruta dentro del bucket a partir de una URL pública
  const getStoragePathFromUrl = (url) => {
    if (!url) return null;
    const safeDecode = (s) => {
      try { return decodeURIComponent(s); } catch { return s; }
    };

    try {
      const u = new URL(url);
      // Ejemplo de pathname: /storage/v1/object/public/<bucket>/<path>
      const m = u.pathname.match(/\/object\/public\/([^\/]+)\/(.+)/);
      if (m && m[2]) return safeDecode(m[2]); // devuelve la ruta relativa dentro del bucket
    } catch (e) {
      // ignore
    }
    // Fallbacks
    const i = url.indexOf('/testimonios/');
    if (i > -1) return safeDecode(url.slice(i + '/testimonios/'.length));
    const match = url.match(/testimonios\/(.+)$/);
    if (match) return safeDecode(match[1]);
    return null;
  };

  const handleTestimonioSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Validación cliente: solo permitir .mp4 (recomendado para compatibilidad navegador)
      if (testimonioFile) {
        const isMp4Mime = testimonioFile.type === 'video/mp4';
        const isMp4Ext = String(testimonioFile.name).toLowerCase().endsWith('.mp4');
        if (!isMp4Mime && !isMp4Ext) {
          setMessage('Formato no permitido: usa .mp4 (H.264) para asegurar compatibilidad en navegadores.');
          setLoading(false);
          return;
        }
      }

      // Comprobar existencia del bucket y permisos básicos antes de subir
      try {
        const { data: listData, error: listError } = await supabase.storage.from('testimonios').list('', { limit: 1 });
        if (listError) {
          if (listError?.status === 404 || String(listError).toLowerCase().includes('bucket')) {
            setMessage('Error: el bucket "testimonios" no existe en Supabase Storage. Crea el bucket desde el dashboard y vuelve a intentarlo.');
            setLoading(false);
            return;
          }
          if (listError?.status === 403) {
            setMessage('No tienes permisos para acceder al bucket "testimonios". Asegúrate de estar autenticado y de que la política de Storage permita uploads desde clientes.');
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        // ignore errores de comprobación (continuar para intentar la subida y mostrar error más detallado)
      }

      let videoUrl = null;
      if (testimonioFile) {
        videoUrl = await uploadTestimonioVideo(testimonioFile);
        if (!videoUrl) {
          // upload falló y ya se notificó en uploadTestimonioVideo
          setLoading(false);
          return;
        }
      }

      if (editingTestimonioId) {
        // Si se subió un nuevo video, intentar borrar el antiguo
        const existing = testimonios.find(t => t.id === editingTestimonioId);
        if (videoUrl && existing?.video_url) {
          const oldPath = getStoragePathFromUrl(existing.video_url);
          if (oldPath) {
            const { error: removeError } = await supabase.storage.from('testimonios').remove([oldPath]);
            if (removeError) {
              setMessage(prev => (prev ? prev + ' | ' : '') + `No se pudo borrar archivo antiguo: ${removeError.message}`);
            }
          }
        }

        const updateData = { caption: testimonioForm.caption };
        if (videoUrl) updateData.video_url = videoUrl;
        const { error: updateError } = await supabase.from("testimonios").update(updateData).eq("id", editingTestimonioId);
        if (updateError) {
          if (updateError?.status === 403 || String(updateError?.message || '').toLowerCase().includes('row-level')) {
            setMessage('Acceso denegado por Row-Level Security al actualizar. Revisa las políticas de la tabla `testimonios` en Supabase.');
            setLoading(false);
            return;
          }
          throw updateError;
        }
        setMessage("✅ Testimonio actualizado");
      } else {
        if (!videoUrl) {
          setMessage("⚠️ Selecciona un video");
          setLoading(false);
          return;
        }
        const { data: insertData, error: insertError } = await supabase.from("testimonios").insert([{ ...testimonioForm, video_url: videoUrl }]);
        if (insertError) {
          if (insertError?.status === 403 || String(insertError?.message || '').toLowerCase().includes('row-level')) {
            setMessage(
              'Insert falló por Row-Level Security. Ejecuta en SQL Editor:\n\n' +
              "ALTER TABLE public.testimonios ENABLE ROW LEVEL SECURITY;\n" +
              "CREATE POLICY \"Authenticated can manage testimonios\" ON public.testimonios FOR ALL TO authenticated USING (true) WITH CHECK (true);\n\n" +
              "O crea una política restringida a administradores si lo prefieres."
            );
            setLoading(false);
            return;
          }
          throw insertError;
        }
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
    setTestimonioModalOpen(true);
  };

  const resetTestimonioForm = () => {
    setEditingTestimonioId(null);
    setTestimonioForm({ caption: "" });
    setTestimonioFile(null);
    setTestimonioModalOpen(false);
  };

  const deleteTestimonio = async (id) => {
    if (!confirm("¿Eliminar testimonio?")) return;
    setLoading(true);
    setMessage("");
    try {
      const t = testimonios.find(item => item.id === id);
      if (t?.video_url) {
        const path = getStoragePathFromUrl(t.video_url);
        if (path) {
          const { error: removeError } = await supabase.storage.from('testimonios').remove([path]);
          if (removeError) {
            console.warn('Error eliminando archivo en Storage:', removeError);
            setMessage(`Advertencia: no se pudo eliminar archivo: ${removeError.message}`);
          }
        }
      }

      const { error } = await supabase.from("testimonios").delete().eq("id", id);
      if (error) setMessage(error.message);
      else {
        setMessage("Testimonio eliminado");
        fetchTestimonios();
      }
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setLoading(false);
    }
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
    setTestimonios([]);
  };

  // Diagnóstico RLS + Storage: list + upload pequeño para reproducir error
  const runDiagnostics = async () => {
    setMessage("");
    setHeroLoading(true);
    try {
      const resp = await supabase.auth.getSession();
      console.log('DIAG session:', resp);
      setMessage(resp?.data?.session ? 'Sesión activa: ' + (resp.data.session.user?.email || resp.data.session.user?.id) : 'No hay sesión');

      const { data: listData, error: listErr } = await supabase.storage.from('hero').list('', { limit: 5 });
      console.log('DIAG list hero:', { listData, listErr });
      if (listErr) {
        setMessage(prev => (prev ? prev + ' | ' : '') + `List error: ${listErr.message || JSON.stringify(listErr)}`);
      } else {
        setMessage(prev => (prev ? prev + ' | ' : '') + `Hero list OK (${(listData||[]).length} items)`);
      }

      // Intento de subir archivo diagnóstico pequeño
      const f = new File(['diagnostic'], `diag-${Date.now()}.txt`, { type: 'text/plain' });
      const path = `diag/diag-${Date.now()}.txt`;
      const { data: upData, error: upErr } = await supabase.storage.from('hero').upload(path, f, { upsert: true, contentType: 'text/plain' });
      console.log('DIAG upload result:', { upData, upErr });
      if (upErr) {
        setMessage(prev => (prev ? prev + ' | ' : '') + `Upload error: ${upErr.message || JSON.stringify(upErr)}`);
      } else {
        setMessage(prev => (prev ? prev + ' | ' : '') + 'Upload OK — eliminando...');
        const { error: rmErr } = await supabase.storage.from('hero').remove([path]);
        console.log('DIAG remove result:', rmErr);
        if (rmErr) setMessage(prev => (prev ? prev + ' | ' : '') + `Remove error: ${rmErr.message || JSON.stringify(rmErr)}`);
        else setMessage(prev => (prev ? prev + ' | ' : '') + 'Remove OK');
      }
    } catch (e) {
      console.error('DIAG exception', e);
      setMessage(`Diagnóstico error: ${e.message || String(e)}`);
    } finally {
      setHeroLoading(false);
    }
  };

  // Exponer helper para ejecutar desde la consola: `window.runDiagnostics()`
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.runDiagnostics = runDiagnostics;
      return () => { try { delete window.runDiagnostics; } catch (e) {} };
    }
  }, [runDiagnostics]);

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
          <button className="btn-secondary btn-diagnostics" onClick={runDiagnostics} title="Ejecutar diagnóstico RLS" aria-label="Diagnóstico RLS">Diagnóstico RLS</button>
          <button className="btn-secondary btn-logout" onClick={signOut}>Cerrar sesión</button>
        </div>
      </header>

      {/* Pestañas */}
      <div className="admin-tabs">
        <button onClick={() => setActiveTab("productos")} className={`admin-tab ${activeTab === "productos" ? "active" : ""}`}>Productos</button>
        <button onClick={() => setActiveTab("promociones")} className={`admin-tab ${activeTab === "promociones" ? "active" : ""}`}>Promociones</button>
        <button onClick={() => setActiveTab("testimonios")} className={`admin-tab ${activeTab === "testimonios" ? "active" : ""}`}>Testimonios</button>
        <button onClick={() => setActiveTab("hero")} className={`admin-tab ${activeTab === "hero" ? "active" : ""}`}>Hero</button>
        <button onClick={() => setActiveTab("garantias")} className={`admin-tab ${activeTab === "garantias" ? "active" : ""}`}>Garantías</button>
      </div>

      {activeTab === "productos" && (
        <>
          <section className="admin-section" style={{ marginTop: "1rem" }}>
            <h3>{editingProductId ? "Editar producto" : "Crear nuevo producto"}</h3>
            {editingProductId && (
              <p style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                Editando ID: {editingProductId}
                <button
                  type="button"
                  onClick={resetProductForm}
                  style={{ marginLeft: "1rem", background: "none", border: "none", color: "#fcd901", cursor: "pointer" }}
                >
                  Cancelar edición
                </button>
              </p>
            )}
            <form onSubmit={handleProductSubmit} className="admin-form">
              <input className="admin-input" placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm(s => ({ ...s, name: e.target.value }))} required />
              <input className="admin-input" placeholder="Precio" value={productForm.price} onChange={(e) => setProductForm(s => ({ ...s, price: e.target.value }))} required />
              <textarea className="admin-input" placeholder="Descripción" value={productForm.description} onChange={(e) => setProductForm(s => ({ ...s, description: e.target.value }))} />
              <input className="admin-input" type="file" multiple accept="image/*" onChange={(e) => setProductFiles(e.target.files)} />
              {editingProductId && (
                <p style={{ fontSize: "0.8rem", color: "#aaa" }}>
                  Si no seleccionas nuevas imágenes, se conservarán las actuales.
                </p>
              )}
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : editingProductId ? "Actualizar producto" : "Crear producto"}</button>
              {editingProductId && (
                <button type="button" className="btn-secondary" onClick={resetProductForm}>
                  Cancelar
                </button>
              )}
            </form>
          </section>

          {/* Modal de edición */}
          {editModalOpen && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
              <div style={{ background: "#0b0b0b", padding: 20, borderRadius: 12, width: "min(720px, 96%)", color: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0 }}>Editar producto</h3>
                  <button onClick={resetProductForm} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }} aria-label="Cerrar">✖</button>
                </div>

                <form onSubmit={handleProductSubmit} className="admin-form" style={{ marginTop: 12 }}>
                  <input className="admin-input" placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm(s => ({ ...s, name: e.target.value }))} required />
                  <input className="admin-input" placeholder="Precio" value={productForm.price} onChange={(e) => setProductForm(s => ({ ...s, price: e.target.value }))} required />
                  <textarea className="admin-input" placeholder="Descripción" value={productForm.description} onChange={(e) => setProductForm(s => ({ ...s, description: e.target.value }))} />

                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {editingProductImages && editingProductImages.length > 0 ? (
                      editingProductImages.map((src, idx) => (
                        <img key={idx} src={src} alt={`preview-${idx}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
                      ))
                    ) : (
                      <div style={{ color: "#aaa", fontSize: 13 }}>Sin imágenes actuales</div>
                    )}
                  </div>

                  <label style={{ fontSize: 13, color: "#aaa", marginTop: 8 }}>Subir nuevas imágenes (opcional)</label>
                  <input className="admin-input" type="file" multiple accept="image/*" onChange={(e) => setProductFiles(e.target.files)} />

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : "Actualizar producto"}</button>
                    <button type="button" className="btn-secondary" onClick={resetProductForm}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <section style={{ marginTop: "2rem" }}>
            <h3>Productos ({products.length})</h3>
            {loading && <p>Cargando...</p>}
            <div className="productos-grid admin-grid" style={{ marginTop: "1rem" }}>
              {products.map(p => (
                <div key={p.id} className="producto-card" style={{ maxWidth: 320, position: "relative", overflow: "hidden" }}>
                  {p.images && p.images[0] ? (
                    <img src={p.images[0]} alt={p.name || "imagen"} className="producto-imagen" />
                  ) : (
                    <div className="producto-imagen producto-imagen--placeholder" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span>Sin imagen</span>
                    </div>
                  )}

                  {/* Botón Editar (debajo de Eliminar) - moved from overlay to stacked action */}

                  <strong style={{ color: "#fff" }}>{p.name}</strong>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ color: "rgba(255,255,255,0.9)" }}>{p.description}</div>
                    <div style={{ marginTop: 6, fontWeight: 800 }}>${p.price}</div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: "0.6rem", alignItems: "center" }}>
                    <button className="btn-secondary" onClick={() => deleteProduct(p.id)}>Eliminar</button>
                    <button className="btn-secondary" onClick={() => startEditProduct(p)}>Editar</button>
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
                  <img src={promo.imagen_url} className="producto-imagen" alt={promo.alt || promo.nombre} style={{ width: "100%", borderRadius: "12px", marginBottom: "0.5rem" }} />
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

        {activeTab === "testimonios" && (
          <>
            <section className="admin-section" style={{ marginTop: "1rem" }}>
              <h3>{editingTestimonioId ? "Editar testimonio" : "Crear nuevo testimonio"}</h3>
              {editingTestimonioId && (
                <p style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                  Editando ID: {editingTestimonioId}
                  <button
                    type="button"
                    onClick={resetTestimonioForm}
                    style={{ marginLeft: "1rem", background: "none", border: "none", color: "#fcd901", cursor: "pointer" }}
                  >
                    Cancelar edición
                  </button>
                </p>
              )}

              <form onSubmit={handleTestimonioSubmit} className="admin-form">
                <input className="admin-input" placeholder="Caption (opcional)" value={testimonioForm.caption} onChange={(e) => setTestimonioForm(s => ({ ...s, caption: e.target.value }))} />
                <input className="admin-input" type="file" accept="video/*" onChange={(e) => setTestimonioFile(e.target.files[0])} />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : editingTestimonioId ? "Actualizar testimonio" : "Crear testimonio"}</button>
                  {editingTestimonioId && (
                    <button type="button" className="btn-secondary" onClick={resetTestimonioForm}>Cancelar</button>
                  )}
                </div>
              </form>
            </section>

            <section style={{ marginTop: "2rem" }}>
              <h3>Testimonios ({testimonios.length})</h3>
              {loading && <p>Cargando...</p>}
              <div className="admin-grid" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "1rem" }}>
                {testimonios.map(t => (
                  <div key={t.id} className="promo-card" style={{ maxWidth: "320px", textAlign: "center", color: "#fff" }}>
                    <video src={t.video_url && encodeURI(t.video_url)} controls className="testimonio-video" style={{ width: "100%", borderRadius: 12, marginBottom: 8 }} />
                    <p style={{ color: "#ccc", minHeight: 32 }}>{t.caption}</p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button className="btn-secondary" onClick={() => startEditTestimonio(t)}>Editar</button>
                      <button className="btn-secondary" onClick={() => deleteTestimonio(t.id)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "hero" && (
          <section className="admin-section" style={{ marginTop: "1rem" }}>
            <h3>Video Hero</h3>
            <p style={{ color: '#ccc' }}>Sube el video que se mostrará en la sección principal (se transcodificará en el servidor si corresponde).</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="file" accept="video/*" onChange={(e) => setHeroFile(e.target.files[0])} />
              <button className="btn-primary" onClick={async (e) => {
                e.preventDefault();
                if (!heroFile) return setMessage('Selecciona un archivo');
                setHeroLoading(true);
                setMessage('Subiendo video del hero...');
                try {
                  const sanitizeFileName = (name) => {
                    if (!name) return 'hero';
                    return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-.]/g, '');
                  };
                  const safeName = sanitizeFileName(heroFile.name);
                  // Guardar solo la ruta relativa dentro del bucket 'hero' (evita 'hero/hero/...' en la URL)
                  const filePath = `${Date.now()}_${safeName}`;
                  // Obtener sesión actual (diagnóstico)
                  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                  console.log('=== DIAGNÓSTICO DE SESIÓN ===');
                  console.log('Session:', session);
                  console.log('User ID:', session?.user?.id);
                  console.log('User role:', session?.user?.role);
                  console.log('Error de sesión:', sessionError);
                  console.log('==============================');

                  // Luego sigue con el upload (logs añadidos para diagnóstico)
                  console.log('Iniciando upload Hero', { filePath, name: heroFile?.name, size: heroFile?.size, type: heroFile?.type });
                  const uploadStart = Date.now();
                  const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('hero')
                    .upload(filePath, heroFile, { upsert: true, contentType: heroFile.type });

                  console.log('Upload finalizado', { durationMs: Date.now() - uploadStart, uploadData, uploadError });

                  if (uploadError) {
                    console.error('Upload error', uploadError);
                    if (String(uploadError.message || '').toLowerCase().includes('bucket not found')) {
                      setMessage('Error: el bucket "hero" no existe en Supabase Storage. Crea el bucket desde el dashboard y vuelve a intentarlo.');
                      setHeroLoading(false);
                      return;
                    }
                    setMessage(`Error subiendo archivo: ${uploadError.message || JSON.stringify(uploadError)}`);
                    setHeroLoading(false);
                    return;
                  }

                  const { data: publicData } = supabase.storage.from('hero').getPublicUrl(filePath);
                  console.log('getPublicUrl result', publicData);
                  const publicUrl = publicData?.publicUrl || filePath;
                  console.log('Public URL para hero:', publicUrl);

                  const { data: upsertData, error: upsertError } = await supabase.from('site_settings').upsert([{ key: 'hero_video_url', value: publicUrl }]);
                  console.log('Upsert site_settings result', { upsertData, upsertError });
                  if (upsertError) throw upsertError;
                  setHeroUrl(publicUrl);
                  setMessage('✅ Hero actualizado');
                } catch (err) {
                  setMessage(`Error: ${err.message || String(err)}`);
                } finally {
                  setHeroLoading(false);
                }
              }} disabled={heroLoading}>
                {heroLoading ? 'Subiendo...' : 'Subir Hero'}
              </button>
            </div>

            {heroUrl && (
              <div style={{ marginTop: 12 }}>
                <h4>Preview actual</h4>
                <video src={heroUrl} controls style={{ width: '100%', height: 'auto', maxWidth: 350, borderRadius: 12 }} />
              </div>
            )}
          </section>
        )}

        {activeTab === "garantias" && (
          <section className="admin-section" style={{ marginTop: "1rem" }}>
            <h3>Editar Garantías</h3>
            <p style={{ color: '#ccc' }}>Modifica los textos de garantías que se muestran en la página pública.</p>

            {garantiasLoading && <p>Cargando garantías...</p>}

            <div style={{ marginTop: 12 }}>
              {garantias && garantias.length > 0 ? (
                garantias.map((g, idx) => (
                  <div key={idx} style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: '#0b0b0b' }}>
                    <input className="admin-input" placeholder="Título" value={g.title} onChange={(e) => updateGarantia(idx, 'title', e.target.value)} />
                    <textarea className="admin-input" placeholder="Texto principal" value={g.text1} onChange={(e) => updateGarantia(idx, 'text1', e.target.value)} />
                    <textarea className="admin-input" placeholder="Excepciones" value={g.text2} onChange={(e) => updateGarantia(idx, 'text2', e.target.value)} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button className="btn-secondary" onClick={() => deleteGarantia(idx)}>Eliminar</button>
                    </div>
                  </div>
                ))
              ) : (
                <p>No hay garantías definidas. Agrega una nueva.</p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn-primary" onClick={addGarantia}>Agregar garantía</button>
                <button className="btn-primary" onClick={saveGarantias} disabled={garantiasLoading}>{garantiasLoading ? 'Guardando...' : 'Guardar garantías'}</button>
              </div>
            </div>
          </section>
        )}

        {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}
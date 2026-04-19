import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles.css";

export default function Promociones() {
  const [promociones, setPromociones] = useState([]);
  const [indice, setIndice] = useState(0);
  const [fade, setFade] = useState(false);
  const [loading, setLoading] = useState(true);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Cargar promociones desde Supabase al montar el componente
  useEffect(() => {
    const fetchPromociones = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("promociones")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error al cargar promociones:", error.message);
        setPromociones([]);
      } else {
        setPromociones(data || []);
      }
      setLoading(false);
    };

    fetchPromociones();
  }, []);

  const total = promociones.length;

  // Mostrar carga o mensaje si no hay datos
  if (loading) {
    return (
      <section id="promociones" className="promociones-section" data-animate="fade-up">
        <div className="container" style={{ textAlign: "center", padding: "3rem" }}>
          <p>Cargando promociones...</p>
        </div>
      </section>
    );
  }

  if (total === 0) {
    return (
      <section id="promociones" className="promociones-section" data-animate="fade-up">
        <div className="container" style={{ textAlign: "center", padding: "3rem" }}>
          <p>No hay promociones disponibles en este momento.</p>
        </div>
      </section>
    );
  }

  const promocionActual = promociones[indice];

  const handleComprar = () => {
    const mensaje = `Hola Phone Colombia, vengo de la página web y me interesa la promoción ${promocionActual.nombre} (precio publicado: $${promocionActual.precio}).`;
    const whatsappUrl = `https://wa.me/573007190977?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const prevPromo = () => {
    setFade(true);
    setTimeout(() => {
      setIndice((prev) => (prev === 0 ? total - 1 : prev - 1));
      setFade(false);
    }, 250);
  };

  const nextPromo = () => {
    setFade(true);
    setTimeout(() => {
      setIndice((prev) => (prev === total - 1 ? 0 : prev + 1));
      setFade(false);
    }, 250);
  };

  const goToPromo = (nuevoIndice) => {
    if (nuevoIndice === indice) return;
    setFade(true);
    setTimeout(() => {
      setIndice(nuevoIndice);
      setFade(false);
    }, 250);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prevPromo();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextPromo();
    }
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].clientX;
    touchEndX.current = e.changedTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.changedTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const dist = touchStartX.current - touchEndX.current;
    if (dist > 40) nextPromo();
    else if (dist < -40) prevPromo();
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <section id="promociones" className="promociones-section" data-animate="fade-up">
      <div className="promocion-cinta" aria-hidden="true">
        <span className="promocion-cinta-texto">
          SUPERPROMO/SUPERPROMO/SUPERPROMO/SUPERPROMO/SUPERPROMO/SUPERPROMO/SUPERPROMO
        </span>
      </div>
      <div className="container">
        <header className="promocion-header">
          <h2 className="promocion-heading">Promociones destacadas</h2>
        </header>
        <article
          className="promocion-banner"
          aria-label="Carrusel de promociones"
          aria-roledescription="carousel"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            className="promocion-arrow promocion-arrow--left"
            aria-label="Anterior"
            onClick={prevPromo}
          >
            <svg width="32" height="32" viewBox="0 0 24 24">
              <path
                d="M15 18l-6-6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className={`promocion-media promocion-fade${fade ? " fade-out" : " fade-in"}`}>
            <img
              src={promocionActual.imagen_url}
              alt={promocionActual.alt || promocionActual.nombre}
              className="promocion-image"
            />
          </div>

          <span className="promocion-brand">
            <img
              src={`${import.meta.env.BASE_URL}imagenes/Promociones/logo_letras_promociones.png`}
              alt="Phone Colombia"
            />
          </span>

          <div className="promocion-content" aria-live="polite">
            <p className="promocion-title">{promocionActual.nombre}</p>
            <p className="promocion-label">Llévalo por:</p>
            <p className="promocion-price">${promocionActual.precio}</p>
            <p className="promocion-bundle">{promocionActual.bundle}</p>
            <button type="button" className="promocion-cta" onClick={handleComprar}>
              Comprar
            </button>
          </div>

          <span className="promocion-brand-2">
            <img
              src={`${import.meta.env.BASE_URL}imagenes/Promociones/logo_pequeño_promociones.png`}
              alt="Phone Colombia"
            />
          </span>

          <button
            className="promocion-arrow promocion-arrow--right"
            aria-label="Siguiente"
            onClick={nextPromo}
          >
            <svg width="32" height="32" viewBox="0 0 24 24">
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </article>

        <div className="promocion-controls">
          <p className="promocion-count">
            {indice + 1}/{total}
          </p>
          <div className="entregas-dots promocion-dots">
            {promociones.map((_, i) => (
              <button
                key={i}
                className={`entregas-dot promocion-dot${i === indice ? " active" : ""}`}
                aria-label={`Ir a la promoción ${i + 1}`}
                aria-current={i === indice}
                onClick={() => goToPromo(i)}
                tabIndex={0}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
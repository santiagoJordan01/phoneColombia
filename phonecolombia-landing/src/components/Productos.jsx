import React, { useState, useEffect, useRef } from "react";
import api from "../lib/apiClient";
import Producto from "./Producto";
import "../styles.css";

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [indice, setIndice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [slideTransition, setSlideTransition] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const trackRef = useRef(null);
  const totalItems = productos.length;

  const getItemsPerPage = () => {
    if (typeof window === "undefined") return 3;
    const w = window.innerWidth;
    if (w < 640) return 1; // móvil
    if (w < 1024) return 2; // tablet
    return 3; // escritorio
  };

  const [itemsPerPage, setItemsPerPage] = useState(getItemsPerPage);

  useEffect(() => {
    const onResize = () => setItemsPerPage(getItemsPerPage());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const maxIndice = Math.max(0, (totalPages - 1) * itemsPerPage);

  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true);
      try {
        const data = await api.getProducts();
        setProductos(data || []);
      } catch (error) {
        console.error("Error al cargar productos:", error.message);
        setProductos([]);
      }
      setLoading(false);
    };
    fetchProductos();
  }, []);

  // Reiniciar índice si cambian los productos o el layout (items por página)
  useEffect(() => {
    setIndice(0);
  }, [productos.length, itemsPerPage]);

  const prevSlide = () => {
    if (indice === 0) return;
    setSlideTransition(true);
    setIndice((prev) => Math.max(0, prev - itemsPerPage));
    setTimeout(() => setSlideTransition(false), 300);
  };

  const nextSlide = () => {
    if (indice >= maxIndice) return;
    setSlideTransition(true);
    setIndice((prev) => Math.min(prev + itemsPerPage, maxIndice));
    setTimeout(() => setSlideTransition(false), 300);
  };

  const goToSlide = (newIndex) => {
    const clamped = Math.min(Math.max(newIndex, 0), maxIndice);
    if (clamped === indice) return;
    setSlideTransition(true);
    setIndice(clamped);
    setTimeout(() => setSlideTransition(false), 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevSlide();
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      nextSlide();
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
    if (dist > 40) nextSlide();
    else if (dist < -40) prevSlide();
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  if (loading) {
    return (
      <section className="productos-section" id="productos" data-animate="fade-up">
        <div className="container" style={{ textAlign: "center", padding: "3rem" }}>
          <p>Cargando productos...</p>
        </div>
      </section>
    );
  }

  if (totalItems === 0) {
    return (
      <section className="productos-section" id="productos" data-animate="fade-up">
        <div className="container" style={{ textAlign: "center", padding: "3rem" }}>
          <p>No hay productos disponibles en este momento.</p>
        </div>
      </section>
    );
  }

  // Página actual de productos
  const currentPage = Math.floor(indice / itemsPerPage) + 1;

  return (
    <section className="productos-section" id="productos" data-animate="fade-up">
      <div className="container">
        {/* Título vertical (opcional, mantén tu diseño) */}
        <div className="productos-title-vertical">
          <h2>Productos</h2>
        </div>

        {/* Carrusel tipo entregas */}
        <div className="entregas-carousel">
          <div
            className="entregas-viewport"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="entregas-track productos-track"
              ref={trackRef}
              style={{
                transform: `translateX(-${indice * (100 / itemsPerPage)}%)`,
                transition: slideTransition ? "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
              }}
            >
              {productos.map((producto) => (
                <div
                  key={producto.id}
                  className="entrega-card producto-slide"
                  style={{ flex: `0 0 ${100 / itemsPerPage}%`, boxSizing: "border-box" }}
                >
                  <Producto
                    imagen={producto.images}
                    nombre={producto.name}
                    descripcion={producto.description}
                    precio={producto.price}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Controles: flechas y dots */}
          <div className="entregas-controls">
            <button
              className="entregas-toggle"
              onClick={prevSlide}
              disabled={indice === 0}
              aria-label="Anterior"
            >
              <svg className="entregas-toggle-icon" viewBox="0 0 24 24" width="20" height="20">
                <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="entregas-dots">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  className={`entregas-dot ${i + 1 === currentPage ? "active" : ""}`}
                  onClick={() => goToSlide(i * itemsPerPage)}
                  aria-label={`Ir a página ${i + 1}`}
                />
              ))}
            </div>

            <button
              className="entregas-toggle"
              onClick={nextSlide}
              disabled={indice >= maxIndice}
              aria-label="Siguiente"
            >
              <svg className="entregas-toggle-icon" viewBox="0 0 24 24" width="20" height="20">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
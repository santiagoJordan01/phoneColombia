import React, { useEffect, useRef, useState } from "react";
import "../styles.css";

export default function Clientes() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDesktopView, setIsDesktopView] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const entregas = [
    { imagen: `${import.meta.env.BASE_URL}imagenes/Entregas/1.jpg` },
    { imagen: `${import.meta.env.BASE_URL}imagenes/Entregas/2.jpg` },
    { imagen: `${import.meta.env.BASE_URL}imagenes/Entregas/3.jpg` },
    { imagen: `${import.meta.env.BASE_URL}imagenes/Entregas/4.jpg` },
    { imagen: `${import.meta.env.BASE_URL}imagenes/Entregas/5.jpg` },
    { imagen: `${import.meta.env.BASE_URL}imagenes/Entregas/6.jpg` },
  ];

  const DOT_SERIES_COUNT = 2;
  const totalEntregas = entregas.length;
  const totalSeries = Math.min(DOT_SERIES_COUNT, totalEntregas);
  const seriesSize = Math.max(1, Math.ceil(totalEntregas / DOT_SERIES_COUNT));
  const activeSeriesIndex = Math.min(Math.floor(currentIndex / seriesSize), totalSeries - 1);

  const goNext = () => {
    if (isDesktopView) {
      setCurrentIndex(prev => {
        const currentSeries = Math.min(Math.floor(prev / seriesSize), totalSeries - 1);
        const nextSeries = (currentSeries + 1) % totalSeries;
        return Math.min(nextSeries * seriesSize, totalEntregas - 1);
      });
      return;
    }

    setCurrentIndex(prev => (prev + 1) % totalEntregas);
  };

  const goPrev = () => {
    if (isDesktopView) {
      setCurrentIndex(prev => {
        const currentSeries = Math.min(Math.floor(prev / seriesSize), totalSeries - 1);
        const prevSeries = (currentSeries - 1 + totalSeries) % totalSeries;
        return Math.min(prevSeries * seriesSize, totalEntregas - 1);
      });
      return;
    }

    setCurrentIndex(prev => (prev === 0 ? totalEntregas - 1 : prev - 1));
  };

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      goNext();
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused, isDesktopView, totalEntregas, totalSeries, seriesSize]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1025px)");
    const updateView = () => setIsDesktopView(mediaQuery.matches);

    updateView();
    mediaQuery.addEventListener("change", updateView);

    return () => mediaQuery.removeEventListener("change", updateView);
  }, []);

  const dotSeries = Array.from({ length: totalSeries }, (_, seriesIndex) => {
    const startIndex = seriesIndex * seriesSize;
    return {
      key: `series-${seriesIndex}`,
      index: Math.min(startIndex, totalEntregas - 1),
      seriesIndex,
      onClick: () => setCurrentIndex(Math.min(startIndex, totalEntregas - 1)),
    };
  });

  const handleTouchStart = event => {
    touchStartX.current = event.changedTouches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchMove = event => {
    touchEndX.current = event.changedTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 40;

    if (swipeDistance > minSwipeDistance) {
      goNext();
    } else if (swipeDistance < -minSwipeDistance) {
      goPrev();
    }

    setIsPaused(false);
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <section id="clientes" className="clientes-section" data-animate="fade-up">
      <div className="container">
        <h2 className="section-title" data-animate="fade-up">Nuestros Clientes</h2>
        <div
          className="entregas-carousel"
          data-animate="fade-up"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
        >
          <h3 className="entregas-title">Entregas realizadas</h3>
          <div className="entregas-viewport">
            <div
              className="entregas-track"
              style={{ transform: `translateX(-${(isDesktopView ? activeSeriesIndex : currentIndex) * 100}%)` }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {entregas.map((item, index) => (
                <figure className="entrega-card" key={index}>
                  <div className="inner">
                    <img src={item.imagen} alt={`Entrega ${index + 1}`} />
                  </div>
                  <figcaption>
                    <strong>{item.titulo}</strong>
                    <span>{item.detalle}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
          <div className="entregas-controls">
            <div className="entregas-dots" role="tablist" aria-label="Indicadores de entregas">
              {dotSeries.map((dot) => (
                <button
                  key={dot.key}
                  type="button"
                  className={`entregas-dot ${activeSeriesIndex === dot.seriesIndex ? "active" : ""}`}
                  onClick={dot.onClick}
                  aria-label={`Ir a la serie ${dot.seriesIndex + 1} de entregas`}
                  aria-current={activeSeriesIndex === dot.seriesIndex}
                />
              ))}
            </div>
            <button
              type="button"
              className="entregas-toggle"
              onClick={() => setIsPaused((prev) => !prev)}
              aria-pressed={isPaused}
              aria-label={isPaused ? "Reanudar" : "Pausar"}
            >
              {isPaused ? (
                <svg
                  className="entregas-toggle-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
                </svg>
              ) : (
                <svg
                  className="entregas-toggle-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

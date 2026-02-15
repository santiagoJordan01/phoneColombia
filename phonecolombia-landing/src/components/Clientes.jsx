import React, { useEffect, useRef, useState } from "react";
import "../styles.css";

export default function Clientes() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
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

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % entregas.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused, entregas.length]);

  const goNext = () => {
    setCurrentIndex(prev => (prev + 1) % entregas.length);
  };

  const goPrev = () => {
    setCurrentIndex(prev => (prev === 0 ? entregas.length - 1 : prev - 1));
  };

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
            <button
              type="button"
              className="entregas-arrow entregas-arrow--left"
              aria-label="Anterior"
              onClick={goPrev}
            >
              <svg
                className="entregas-arrow-icon entregas-arrow-size"
                viewBox="0 0 44 44"
                aria-hidden="true"
              >
                <path
                  d="M8 10 L36 22 L8 34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              className="entregas-track"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
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
            <button
              type="button"
              className="entregas-arrow entregas-arrow--right"
              aria-label="Siguiente"
              onClick={goNext}
            >
              <svg
                className="entregas-arrow-icon entregas-arrow-size"
                viewBox="0 0 44 44"
                aria-hidden="true"
              >
                <path
                  d="M8 10 L36 22 L8 34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="entregas-controls">
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
          <div className="entregas-dots" role="tablist" aria-label="Indicadores de entregas">
            {entregas.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`entregas-dot ${currentIndex === index ? "active" : ""}`}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Ir a la entrega ${index + 1}`}
                aria-current={currentIndex === index}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

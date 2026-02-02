import React, { useEffect, useRef } from "react";
import "../styles.css";

export default function Clientes() {
  const trackRef = useRef(null);
  const entregas = [
    { imagen: "/imagenes/Entregas/1.jpg" },
    { imagen: "/imagenes/Entregas/2.jpg"},
    { imagen: "/imagenes/Entregas/3.jpg"},
    { imagen: "/imagenes/Entregas/4.jpg"},
    { imagen: "/imagenes/Entregas/5.jpg" },
    { imagen: "/imagenes/Entregas/6.jpg" },
  ];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let isPaused = false;
    const pause = () => (isPaused = true);
    const resume = () => (isPaused = false);

    track.addEventListener("mouseenter", pause);
    track.addEventListener("mouseleave", resume);

    const interval = setInterval(() => {
      if (isPaused) return;
      const card = track.querySelector(".entrega-card");
      if (!card) return;

      const styles = getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap || "0");
      const step = card.getBoundingClientRect().width + gap;
      const maxScroll = track.scrollWidth - track.clientWidth;

      if (track.scrollLeft + step >= maxScroll - 2) {
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        track.scrollBy({ left: step, behavior: "smooth" });
      }
    }, 2500);

    return () => {
      clearInterval(interval);
      track.removeEventListener("mouseenter", pause);
      track.removeEventListener("mouseleave", resume);
    };
  }, []);

  return (
    <section id="clientes" className="clientes-section" data-animate="fade-up">
      <div className="container">
        <h2 className="section-title" data-animate="fade-up">Nuestros Clientes</h2>
    

        <div className="entregas-carousel" data-animate="fade-up">
          <h3 className="entregas-title">Entregas realizadas</h3>
          <div className="entregas-track" ref={trackRef}>
            {entregas.map((item, index) => (
              <figure className="entrega-card" key={index}>
                <img src={item.imagen} alt={item.titulo} />
                <figcaption>
                  <strong>{item.titulo}</strong>
                  <span>{item.detalle}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

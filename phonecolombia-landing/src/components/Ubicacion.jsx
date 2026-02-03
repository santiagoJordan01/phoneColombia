import React from "react";
import "../styles.css";

export default function Ubicacion() {
  return (
    <section id="ubicacion" className="ubicacion-section" data-animate="fade-up">
      <div className="container">
        <h2 className="section-title" data-animate="fade-up">Nuestra ubicación</h2>
        <p className="ubicacion-subtitle" data-animate="fade-up">
          Encuéntranos en nuestra tienda principal.
        </p>
        <div className="mapa-wrapper" data-animate="fade-up">
          <iframe
            title="Ubicación Phone Colombia"
            src="https://www.google.com/maps?q=3.387200,-76.539700&z=16&output=embed"
            width="600"
            height="450"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}

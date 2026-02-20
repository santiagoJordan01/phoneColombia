import React, { useState } from "react";
import "../styles.css";

export default function Ubicacion() {
  const [mapaCargado, setMapaCargado] = useState(false);

  return (
    <section id="ubicacion" className="ubicacion-section" data-animate="fade-up">
      <div className="container">
        <h2 className="productos-title-vertical" data-animate="fade-up">Encuentranos</h2>
        <p className="ubicacion-subtitle" data-animate="fade-up">
          Encuéntranos en nuestra tienda principal.
        </p>
        <div className="mapa-mano-container" data-animate="fade-up">
          <img
            src={import.meta.env.BASE_URL + "imagenes/UBICACION/mano_sosteniendo_smartphone.jfif"}
            alt="Mano sosteniendo smartphone"
            className="mano-img"
            draggable="false"
          />
          <div className={`mapa-en-mano ${mapaCargado ? "is-loaded" : ""}`}>
            <iframe
              title="Ubicación Phone Colombia"
              src="https://www.google.com/maps?q=3.387200,-76.539700&z=16&output=embed"
              width="320"
              height="180"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              onLoad={() => setMapaCargado(true)}
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

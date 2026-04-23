import React, { useState } from "react";
import "../styles.css";

export default function Ubicacion() {
  const [mapaCargado, setMapaCargado] = useState(false);

  return (
    <section id="ubicacion" className="ubicacion-section" data-animate="fade-up">
      <div className="container">
        <h2 className="productos-title-vertical">Encuentranos</h2>
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
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3982.848903240402!2d-76.5418110263641!3d3.387057251646903!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e30a15d01b0e85d%3A0x30522b2943d9b583!2sCentro%20Comercial%20San%20Andresito%20Del%20Sur!5e0!3m2!1ses!2sco!4v1776785761708!5m2!1ses!2sco"
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

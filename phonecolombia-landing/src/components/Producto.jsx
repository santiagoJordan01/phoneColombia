import React from "react";
import { formatPrice } from "../lib/currencyCop.js";

export default function Producto({ imagen, nombre, descripcion, precio }) {
  const imagenUrl = Array.isArray(imagen) ? (imagen.length > 0 ? imagen[0] : "") : imagen || "";
  const precioLabel = formatPrice(precio);

  const handleCotizar = () => {
    const mensaje = `Hola Phone Colombia, vengo de la página web y me interesa cotizar el producto ${nombre} (precio publicado: ${precioLabel}).`;
    const whatsappUrl = `https://wa.me/573007190977?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="producto-card">
      <div className="producto-imagen-wrapper">
        {imagenUrl ? (
          <img src={imagenUrl} alt={nombre} className="producto-imagen" />
        ) : (
          <div className="producto-imagen producto-imagen--placeholder" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span>Sin imagen</span>
          </div>
        )}
      </div>

      <div className="producto-content">
        <h3 className="producto-nombre">{nombre}</h3>
        <p className="producto-descripcion">{descripcion}</p>
      </div>
      <div className="producto-footer">
        <span className="producto-precio">{precioLabel}</span>
        <button type="button" className="btn-primary" onClick={handleCotizar}>
          Cotizar
        </button>
      </div>
    </div>
  );
}

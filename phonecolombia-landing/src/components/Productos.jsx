
import React from "react";
import "../styles.css";

export default function Producto({ imagen, nombre, descripcion, precio }) {
  const handleCotizar = () => {
    const mensaje = `Hola Phone Colombia, vengo de la página web y me interesa cotizar el producto ${nombre} (precio publicado: $${precio}).`;
    const whatsappUrl = `https://wa.me/573007190977?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="producto-card">
      <img src={imagen} alt={nombre} className="producto-imagen" />
      <h3 className="producto-nombre">{nombre}</h3>
      <p className="producto-descripcion">{descripcion}</p>
      <div className="producto-footer">
        <span className="producto-precio">${precio}</span>
        <button type="button" className="btn-primary" onClick={handleCotizar}>
          Cotizar
        </button>
      </div>
    </div>
  );
}

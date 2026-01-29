import React from "react";
import "../styles.css";

export default function Producto({ imagen, nombre, descripcion, precio, onClick }) {
  return (
    <div className="producto-card">
      <img src={imagen} alt={nombre} className="producto-imagen" />
      <h3 className="producto-nombre">{nombre}</h3>
      <p className="producto-descripcion">{descripcion}</p>
      <div className="producto-footer">
        <span className="producto-precio">${precio}</span>
        {onClick && (
          <button className="btn-primary" onClick={onClick}>
            Comprar
          </button>
        )}
      </div>
    </div>
  );
}

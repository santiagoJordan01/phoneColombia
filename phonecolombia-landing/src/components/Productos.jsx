
import React from "react";
import "../styles.css";
import { IconWhatsapp, IconInstagram, IconTelegram } from "./SocialIcons";

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
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.2rem' }}>
        <IconWhatsapp />
        <IconInstagram />
        <IconTelegram />
      </div>
    </div>
  );
}

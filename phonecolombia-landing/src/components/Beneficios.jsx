import React from "react";
import "../styles.css";

export default function Beneficios() {
	return (
		<section id="beneficios" className="beneficios-section" data-animate="fade-up">
			<div className="container">
				<h2 className="section-title" data-animate="fade-up">¿Por qué elegir Phone Colombia?</h2>
				<div className="beneficios-grid" data-animate="stagger">
					<div className="beneficio-card" data-animate="fade-up">
						<img src="/imagenes/images.jfif" alt="Garantía" className="beneficio-icono" />
						<h3>Garantía Oficial</h3>
						<p>Todos nuestros productos cuentan con garantía directa y soporte local.</p>
					</div>
					<div className="beneficio-card" data-animate="fade-up">
						<img src="/imagenes/logo-blanco-rojo.jfif" alt="Originalidad" className="beneficio-icono" />
						<h3>100% Originales</h3>
						<p>Solo vendemos smartphones y accesorios originales, nuevos y sellados.</p>
					</div>
					<div className="beneficio-card" data-animate="fade-up">
						<img src="/imagenes/images.jfif" alt="Envíos" className="beneficio-icono" />
						<h3>Envíos a todo el país</h3>
						<p>Recibe tu compra en cualquier ciudad de Colombia, rápido y seguro.</p>
					</div>
				</div>
			</div>
		</section>
	);
}

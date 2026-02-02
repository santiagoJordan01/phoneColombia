import React from "react";
import "../styles.css";

export default function Testimonios() {
	return (
		<section id="testimonios" className="testimonios-section" data-animate="fade-up">
			<div className="container">
				<h2 className="section-title" data-animate="fade-up">Lo que dicen nuestros clientes</h2>
				<div className="testimonios-grid" data-animate="stagger">
					<div className="testimonio-card" data-animate="fade-up">
						<p>"Excelente atención y productos originales. Mi celular llegó rápido y en perfecto estado."</p>
						<span className="testimonio-nombre">- Juan Pérez</span>
					</div>
					<div className="testimonio-card" data-animate="fade-up">
						<p>"La mejor tienda online de tecnología en Colombia. ¡Recomendados!"</p>
						<span className="testimonio-nombre">- Laura Gómez</span>
					</div>
					<div className="testimonio-card" data-animate="fade-up">
						<p>"Me ayudaron a elegir el mejor smartphone para mi trabajo. Muy profesionales."</p>
						<span className="testimonio-nombre">- Andrés Rodríguez</span>
					</div>
				</div>
			</div>
		</section>
	);
}

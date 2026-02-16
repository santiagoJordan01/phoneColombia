
import React from "react";
import "../styles.css";

const beneficios = [
	{
		tag: "Respaldo",
		titulo: "Garantía Oficial",
		descripcion: "Todos nuestros productos cuentan con garantía directa y soporte local especializado.",
	},
	{
		tag: "Calidad",
		titulo: "100% Originales",
		descripcion: "Solo vendemos dispositivos nuevos, originales y sellados. También recibimos tu equipo como parte de pago.",
	},
	{
		tag: "Cobertura",
		titulo: "Envíos a Todo el País",
		descripcion: "Entregamos en toda Colombia con logística segura, seguimiento y atención en cada paso.",
	},
];

export default function Beneficios() {
	return (
		<section id="beneficios" className="beneficios-section" data-animate="fade-up">
			<div className="container">
				<h2 className="section-title" data-animate="fade-up">¿Por qué elegir Phone Colombia?</h2>
				<div className="beneficios-grid" data-animate="stagger">
					{beneficios.map((beneficio) => (
						<article className="beneficio-card" data-animate="fade-up" key={beneficio.titulo}>
							<span className="beneficio-tag">{beneficio.tag}</span>
							<h3>{beneficio.titulo}</h3>
							<p>{beneficio.descripcion}</p>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}

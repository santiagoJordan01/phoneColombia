import React from "react";
import "../styles.css";

export default function Contactanos() {
	return (
		<section id="contacto" className="contacto-section" data-animate="fade-up">
			<div className="container contacto-container">
				<h2 className="section-title" data-animate="fade-up">Contáctanos</h2>
				<form className="contacto-form" data-animate="fade-up">
					<input type="text" placeholder="Nombre" required />
					<input type="email" placeholder="Correo electrónico" required />
					<textarea placeholder="Mensaje" required />
					<button type="submit" className="btn-primary">Enviar</button>
				</form>
				<div className="contacto-info" data-animate="fade-up">
					<p><strong>Email:</strong> info@phonecolombia.com</p>
					<p><strong>WhatsApp:</strong> +57 300 123 4567</p>
				</div>
			</div>
		</section>
	);
}

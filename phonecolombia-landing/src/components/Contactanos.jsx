import React from "react";
import "../styles.css";

export default function Contactanos() {
	const handleSubmit = event => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const nombre = (formData.get("nombre") || "").toString().trim();
		const correo = (formData.get("correo") || "").toString().trim();
		const mensaje = (formData.get("mensaje") || "").toString().trim();

		const texto = `Hola Phone Colombia, mi nombre es ${nombre}.\nCorreo: ${correo}\nMensaje: ${mensaje}`;
		const whatsappUrl = `https://wa.me/573001234567?text=${encodeURIComponent(texto)}`;
		window.open(whatsappUrl, "_blank", "noopener,noreferrer");
	};

	return (
		<section id="contacto" className="contacto-section" data-animate="fade-up">
			<div className="container contacto-container">
				<h2 className="section-title" data-animate="fade-up">Contáctanos</h2>
				<form className="contacto-form" data-animate="fade-up" onSubmit={handleSubmit}>
					<input type="text" name="nombre" placeholder="Nombre" required />
					<input type="email" name="correo" placeholder="Correo electrónico" required />
					<textarea name="mensaje" placeholder="Mensaje" required />
					<button type="submit" className="btn-primary">Enviar</button>
				</form>
				<div className="contacto-info" data-animate="fade-up">
					<p><strong>Email:</strong> info@phonecolombia.com</p>
					<p><strong>WhatsApp:</strong> +57 300 123 4567</p>
					<p><strong>Instagram:</strong> +57 300 123 4567</p>
					<p><strong>TikTok:</strong> +57 300 123 4567</p>


				</div>
			</div>
		</section>
	);
}

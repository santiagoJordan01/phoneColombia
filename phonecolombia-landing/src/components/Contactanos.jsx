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
		const whatsappUrl = `https://wa.me/573007190977?text=${encodeURIComponent(texto)}`;
		window.open(whatsappUrl, "_blank", "noopener,noreferrer");
	};

	return (
		<section id="contacto" className="contacto-section" data-animate="fade-up">
			<div className="container contacto-container">
				<header className="contacto-header" data-animate="fade-up">
					<h2 className="section-title">Contáctanos</h2>
					<p className="contacto-subtitle">Te asesoramos por WhatsApp y resolvemos todas tus dudas.</p>
				</header>

				<div className="contacto-grid">
					<form className="contacto-form" data-animate="fade-up" onSubmit={handleSubmit}>
						<div className="contacto-field">
							<label htmlFor="contacto-nombre">Nombre</label>
							<input id="contacto-nombre" type="text" name="nombre" placeholder="Tu nombre" required />
						</div>
						<div className="contacto-field">
							<label htmlFor="contacto-correo">Correo electrónico</label>
							<input id="contacto-correo" type="email" name="correo" placeholder="tu@correo.com" required />
						</div>
						<div className="contacto-field">
							<label htmlFor="contacto-mensaje">Mensaje</label>
							<textarea id="contacto-mensaje" name="mensaje" placeholder="Cuéntanos qué producto te interesa" required />
						</div>
						<button type="submit" className="btn-primary">Enviar por WhatsApp</button>
					</form>

					<aside className="contacto-info" data-animate="fade-up" aria-label="Canales de contacto">
						<h3>Canales directos</h3>
						<ul className="contacto-info-list">
							<li>
								<span>Email</span>
								<a href="mailto:info@phonecolombia.com">info@phonecolombia.com</a>
							</li>
							<li>
								<span>WhatsApp</span>
								<a href="https://wa.me/573007190977" target="_blank" rel="noopener noreferrer">+57 300 719 0977</a>
							</li>
							<li>
								<span>Instagram</span>
								<a href="https://instagram.com/phonecolombiaoficial" target="_blank" rel="noopener noreferrer">@phonecolombiaoficial</a>
							</li>
							<li>
								<span>TikTok</span>
								<a href="https://www.tiktok.com/@phone_colombia_oficial?_r=1&_t=ZS-947MqCx9vwz" target="_blank" rel="noopener noreferrer">@phonecolombiaoficial</a>
							</li>
						</ul>
					</aside>
					<div  className="logo-contactanos" >
						<img src="/imagenes/Contactanos/logo_letras.png" alt="Logo Phone Colombia" style={{maxWidth:'220px', width:'100%', height:'auto', padding:'1rem'}} />
					</div>
				</div>
			</div>
		</section>
	);
}

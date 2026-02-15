
import React from "react";
import "../styles.css";
import { IconWhatsapp, IconInstagram, IconTelegram } from "./SocialIcons";

export default function Beneficios() {
	return (
		<section id="beneficios" className="beneficios-section" data-animate="fade-up">
			<div className="container">
				<h2 className="section-title" data-animate="fade-up">¿Por qué elegir Phone Colombia?</h2>
				<div className="beneficios-grid" data-animate="stagger">
					<div className="beneficio-card" data-animate="fade-up">
						<img src={`${import.meta.env.BASE_URL}imagenes/images.jfif`} alt="Garantía" className="beneficio-icono" />
						<h3>Garantía Oficial</h3>
						<p>Todos nuestros productos cuentan con garantía directa y soporte local.</p>
						<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.2rem' }}>
							<IconWhatsapp />
							<IconInstagram />
							<IconTelegram />
						</div>
					</div>
					<div className="beneficio-card" data-animate="fade-up">
						<img src={`${import.meta.env.BASE_URL}imagenes/logo-blanco-rojo.jfif`} alt="Originalidad" className="beneficio-icono" />
						<h3>100% Originales</h3>
						<p>Solo vendemos smartphones y accesorios originales, nuevos y sellados.</p>
						<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.2rem' }}>
							<IconWhatsapp />
							<IconInstagram />
							<IconTelegram />
						</div>
					</div>
					<div className="beneficio-card" data-animate="fade-up">
						<img src={`${import.meta.env.BASE_URL}imagenes/images.jfif`} alt="Envíos" className="beneficio-icono" />
						<h3>Envíos a todo el país</h3>
						<p>Recibe tu compra en cualquier ciudad de Colombia, rápido y seguro.</p>
						<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.2rem' }}>
							<IconWhatsapp />
							<IconInstagram />
							<IconTelegram />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

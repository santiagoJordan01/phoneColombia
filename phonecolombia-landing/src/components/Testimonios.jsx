import React from "react";
import "../styles.css";

export default function Testimonios() {
	return (
		<section id="testimonios" className="testimonios-section" data-animate="fade-up">
			<div className="container">
				<h2 className="testimonios-title-tag" data-animate="fade-up">TESTIMONIOS</h2>
				<div className="testimonios-grid" data-animate="stagger">
					<div className="testimonio-card" data-animate="fade-up">
						<video
							src={`${import.meta.env.BASE_URL}imagenes/testimonios/videotestimonio.mp4`}
							autoPlay
							loop
							playsInline
							controls
							style={{ width: "100%", cursor: "pointer" }}
						>
							Tu navegador no soporta la reproducción de video.
						</video>
					</div>
					<div className="testimonio-card" data-animate="fade-up">
						<video
							src={`${import.meta.env.BASE_URL}imagenes/testimonios/videotestimonio.mp4`}
							autoPlay
							loop
							playsInline
							controls
							style={{ width: "100%", cursor: "pointer" }}
						>
							Tu navegador no soporta la reproducción de video.
						</video>
					</div>
					<div className="testimonio-card" data-animate="fade-up">
						<video
							src={`${import.meta.env.BASE_URL}imagenes/testimonios/videotestimonio.mp4`}
							autoPlay
							loop
							playsInline
							controls
							style={{ width: "100%", cursor: "pointer" }}
						>
							Tu navegador no soporta la reproducción de video.
						</video>
					</div>
				</div>
			</div>
		</section>
	);
}

import React, { useEffect, useRef, useState } from "react";
import "../styles.css";

export default function Testimonios() {
	const videos = [
		{ src: `${import.meta.env.BASE_URL}imagenes/testimonios/videotestimonio.mp4` },
		{ src: `${import.meta.env.BASE_URL}imagenes/testimonios/videotestimonio_1.mp4` },
		{ src: `${import.meta.env.BASE_URL}imagenes/testimonios/videotestimonio_2.mp4` }
	];

	const [indiceActual, setIndiceActual] = useState(0);
	const [isCarouselPaused, setIsCarouselPaused] = useState(false);
	const [isVideoPlaying, setIsVideoPlaying] = useState(false);
	const [isMobileView, setIsMobileView] = useState(false);
	const videoRefs = useRef([]);
	const totalVideos = videos.length;
	const videosPorPagina = isMobileView ? 1 : 3;
	const totalPaginas = Math.ceil(totalVideos / videosPorPagina);
	const paginas = Array.from({ length: totalPaginas }, (_, paginaIndex) => {
		const inicio = paginaIndex * videosPorPagina;
		const fin = inicio + videosPorPagina;

		return videos.slice(inicio, fin).map((video, localIndex) => ({
			...video,
			originalIndex: inicio + localIndex
		}));
	});

	useEffect(() => {
		if (typeof window === "undefined") return;

		const mediaQuery = window.matchMedia("(max-width: 768px)");
		const updateViewport = () => setIsMobileView(mediaQuery.matches);

		updateViewport();
		mediaQuery.addEventListener("change", updateViewport);

		return () => mediaQuery.removeEventListener("change", updateViewport);
	}, []);

	useEffect(() => {
		if (indiceActual >= totalPaginas) {
			setIndiceActual(0);
		}
	}, [indiceActual, totalPaginas]);

	useEffect(() => {
		if (isCarouselPaused || isVideoPlaying || totalPaginas <= 1) return;
		const interval = setInterval(() => {
			setIndiceActual(prev => (prev + 1) % totalPaginas);
		}, 4500);
		return () => clearInterval(interval);
	}, [isCarouselPaused, isVideoPlaying, totalPaginas]);

	useEffect(() => {
		videoRefs.current.forEach((video, index) => {
			if (!video) return;
			video.pause();
			if (video.readyState >= 1) {
				try {
					video.currentTime = 0;
				} catch {
					return;
				}
			}
		});
		setIsVideoPlaying(false);
	}, [indiceActual]);

	const toggleVideo = index => {
		const video = videoRefs.current[index];
		if (!video) return;

		if (video.paused) {
			videoRefs.current.forEach((item, itemIndex) => {
				if (!item || itemIndex === index) return;
				item.pause();
			});

			video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
		} else {
			video.pause();
			setIsVideoPlaying(false);
		}
	};

	const seleccionarDot = index => {
		setIndiceActual(index);
		setIsCarouselPaused(true);
		setIsVideoPlaying(false);
	};

	const dots = Array.from({ length: totalPaginas }, (_, index) => ({
		key: `card-${index}`,
		index
	}));

	return (
		<section id="testimonios" className="testimonios-section" data-animate="fade-up">
			<div className="container">
				<h2 className="productos-title-vertical">TESTIMONIOS</h2>
				<div
					className="entregas-carousel"
					data-animate="fade-up"
				>
					<div className="entregas-viewport">
						<div
							className="entregas-track testimonios-track"
							style={{ transform: `translateX(-${indiceActual * 100}%)` }}
						>
							{paginas.map((pagina, paginaIndex) => (
								<div className="testimonios-page" key={`pagina-${paginaIndex}`}>
									{pagina.map(video => (
										<figure className="entrega-card" key={video.originalIndex}>
											<div className="inner">
												<video
													ref={element => {
														videoRefs.current[video.originalIndex] = element;
													}}
													src={video.src}
													playsInline
													preload="metadata"
													className="testimonio-video"
													onPlay={() => setIsVideoPlaying(true)}
													onPause={() => {
														const hayReproduciendo = videoRefs.current.some(item => item && !item.paused && !item.ended);
														setIsVideoPlaying(hayReproduciendo);
													}}
													onEnded={() => {
														const hayReproduciendo = videoRefs.current.some(item => item && !item.paused && !item.ended);
														setIsVideoPlaying(hayReproduciendo);
													}}
													onClick={() => toggleVideo(video.originalIndex)}
												/>
											</div>
										</figure>
									))}
								</div>
							))}
						</div>
					</div>
					<div className="entregas-controls">
						<div className="entregas-dots" aria-label="Indicadores del carrusel de testimonios">
							{dots.map(dot => (
								<button
									key={dot.key}
									type="button"
									style={{ cursor: "pointer" }}
									className={`entregas-dot ${indiceActual === dot.index ? "active" : ""}`}
									onClick={() => seleccionarDot(dot.index)}
									aria-label={`Ir al testimonio ${dot.index + 1}`}
									aria-current={indiceActual === dot.index}
								/>
							))}
						</div>
						<button
							type="button"
							className="entregas-toggle"
							onClick={() => setIsCarouselPaused(prev => !prev)}
							aria-pressed={isCarouselPaused}
							aria-label={isCarouselPaused ? "Reanudar carrusel" : "Pausar carrusel"}
						>
							{isCarouselPaused ? (
								<svg
									className="entregas-toggle-icon"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path d="M8 5v14l11-7-11-7z" fill="currentColor" />
								</svg>
							) : (
								<svg
									className="entregas-toggle-icon"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
								</svg>
							)}
						</button>
					</div>
				</div>
			</div>
		</section>
	);
}

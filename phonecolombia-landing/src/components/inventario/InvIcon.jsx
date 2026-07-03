const SVG_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconSvg({ className, spin, children }) {
  return (
    <svg
      {...SVG_PROPS}
      className={[className, spin ? "inv-spin" : ""].filter(Boolean).join(" ") || undefined}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function InvIcon({ name, className = "inv-btn__icon", spin = false }) {
  switch (name) {
    case "dashboard":
      return (
        <IconSvg className={className} spin={spin}>
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </IconSvg>
      );
    case "inventario":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M16.5 9.4 7.55 4.24" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.29 7 12 12 20.71 7" />
          <line x1="12" y1="22" x2="12" y2="12" />
        </IconSvg>
      );
    case "ventas":
      return (
        <IconSvg className={className} spin={spin}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </IconSvg>
      );
    case "informes":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="8" y2="17" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="16" y1="15" x2="16" y2="17" />
        </IconSvg>
      );
    case "servicio":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M14.7 6.3a1 1 0 0 0 0 .6l5.1 5.1a1 1 0 0 0 .6 0l1.4-1.4a1 1 0 0 0 0-.6l-5.1-5.1a1 1 0 0 0-.6 0L14.7 6.3z" />
          <path d="m16 4 2-2" />
          <path d="m3 21 9-9" />
        </IconSvg>
      );
    case "ajustes":
      return (
        <IconSvg className={className} spin={spin}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </IconSvg>
      );
    case "contenido":
      return (
        <IconSvg className={className} spin={spin}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </IconSvg>
      );
    case "log-out":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </IconSvg>
      );
    case "log-in":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </IconSvg>
      );
    case "plus":
      return (
        <IconSvg className={className} spin={spin}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </IconSvg>
      );
    case "refresh":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M21 12a9 9 0 1 1-9-9" />
          <path d="M21 3v6h-6" />
        </IconSvg>
      );
    case "search":
      return (
        <IconSvg className={className} spin={spin}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3-3" />
        </IconSvg>
      );
    case "user-plus":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </IconSvg>
      );
    case "bookmark":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </IconSvg>
      );
    case "cart-plus":
      return (
        <IconSvg className={className} spin={spin}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          <line x1="12" y1="8" x2="12" y2="14" />
          <line x1="9" y1="11" x2="15" y2="11" />
        </IconSvg>
      );
    case "pencil":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </IconSvg>
      );
    case "check-circle":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </IconSvg>
      );
    case "wallet":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </IconSvg>
      );
    case "eye":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </IconSvg>
      );
    case "calendar":
      return (
        <IconSvg className={className} spin={spin}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </IconSvg>
      );
    case "users":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </IconSvg>
      );
    case "file-text":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </IconSvg>
      );
    case "cash-register":
      return (
        <IconSvg className={className} spin={spin}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </IconSvg>
      );
    case "download":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </IconSvg>
      );
    case "upload":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </IconSvg>
      );
    case "folder":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </IconSvg>
      );
    case "archive":
      return (
        <IconSvg className={className} spin={spin}>
          <rect x="2" y="3" width="20" height="5" rx="1" />
          <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
          <path d="M10 12h4" />
        </IconSvg>
      );
    case "list":
      return (
        <IconSvg className={className} spin={spin}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </IconSvg>
      );
    case "grid":
      return (
        <IconSvg className={className} spin={spin}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </IconSvg>
      );
    case "x-circle":
      return (
        <IconSvg className={className} spin={spin}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </IconSvg>
      );
    case "layers":
      return (
        <IconSvg className={className} spin={spin}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </IconSvg>
      );
    case "palette":
      return (
        <IconSvg className={className} spin={spin}>
          <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
          <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
          <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </IconSvg>
      );
    case "tag":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </IconSvg>
      );
    case "truck":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M10 17h4V5H2v12h3" />
          <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
          <circle cx="7.5" cy="17.5" r="2.5" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </IconSvg>
      );
    case "smartphone":
      return (
        <IconSvg className={className} spin={spin}>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </IconSvg>
      );
    case "rotate-ccw":
      return (
        <IconSvg className={className} spin={spin}>
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </IconSvg>
      );
    case "trash":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </IconSvg>
      );
    case "history":
      return (
        <IconSvg className={className} spin={spin}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </IconSvg>
      );
    case "arrow-left":
      return (
        <IconSvg className={className} spin={spin}>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </IconSvg>
      );
    case "printer":
      return (
        <IconSvg className={className} spin={spin}>
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </IconSvg>
      );
    case "spreadsheet":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
          <line x1="10" y1="9" x2="10" y2="21" />
        </IconSvg>
      );
    case "clipboard-list":
      return (
        <IconSvg className={className} spin={spin}>
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </IconSvg>
      );
    case "credit-card":
      return (
        <IconSvg className={className} spin={spin}>
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </IconSvg>
      );
    case "save":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </IconSvg>
      );
    case "x":
      return (
        <IconSvg className={className} spin={spin}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </IconSvg>
      );
    case "package":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M16.5 9.4 7.55 4.24" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.29 7 12 12 20.71 7" />
        </IconSvg>
      );
    case "shield":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </IconSvg>
      );
    case "play":
      return (
        <IconSvg className={className} spin={spin}>
          <polygon points="5 3 19 12 5 21 5 3" />
        </IconSvg>
      );
    case "video":
      return (
        <IconSvg className={className} spin={spin}>
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </IconSvg>
      );
    case "flag":
      return (
        <IconSvg className={className} spin={spin}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </IconSvg>
      );
    case "filter":
      return (
        <IconSvg className={className} spin={spin}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </IconSvg>
      );
    case "chevron-down":
      return (
        <IconSvg className={className} spin={spin}>
          <polyline points="6 9 12 15 18 9" />
        </IconSvg>
      );
    default:
      return null;
  }
}

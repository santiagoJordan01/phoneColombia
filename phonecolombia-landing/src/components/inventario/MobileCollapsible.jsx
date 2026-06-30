import { useEffect, useState } from "react";

function isDesktopViewport() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 721px)").matches;
}

export default function MobileCollapsible({ summary, children, className = "" }) {
  const [open, setOpen] = useState(() => isDesktopViewport());

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 721px)");
    const sync = () => setOpen(mq.matches ? true : false);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <details
      className={`inv-mobile-fold${className ? ` ${className}` : ""}`}
      open={open}
      onToggle={(e) => {
        if (isDesktopViewport()) {
          e.preventDefault();
          e.currentTarget.open = true;
          setOpen(true);
          return;
        }
        setOpen(e.currentTarget.open);
      }}
    >
      <summary className="inv-mobile-fold__summary">{summary}</summary>
      <div className="inv-mobile-fold__body">{children}</div>
    </details>
  );
}

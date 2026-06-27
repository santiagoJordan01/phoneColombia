import React, { useEffect, useMemo, useRef, useState } from "react";
import ColorSwatch from "./ColorSwatch.jsx";

export default function ColorSelect({
  value,
  onChange,
  colors = [],
  placeholder = "Seleccionar color…",
  id,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return colors;
    return colors.filter((c) => c.name.toLowerCase().includes(q));
  }, [colors, search]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (name) => {
    onChange(name);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="inv-select2" ref={rootRef} id={id}>
      <button
        type="button"
        className={`inv-select2__trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="inv-select2__trigger-inner inv-select2__trigger-inner--row">
          {value && <ColorSwatch name={value} size={16} />}
          <span className={value ? "inv-select2__value" : "inv-select2__placeholder"}>
            {value || placeholder}
          </span>
        </span>
        <span className="inv-select2__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="inv-select2__dropdown" role="listbox">
          <input
            type="text"
            className="inv-select2__search"
            placeholder="Buscar color…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            aria-label="Buscar color"
          />
          <ul className="inv-select2__list">
            <li>
              <button
                type="button"
                className={`inv-select2__option ${!value ? "is-selected" : ""}`}
                onClick={() => pick("")}
              >
                Sin color
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="inv-select2__empty">Sin resultados</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === c.name}
                    className={`inv-select2__option ${value === c.name ? "is-selected" : ""}`}
                    onClick={() => pick(c.name)}
                  >
                    <ColorSwatch name={c.name} size={14} />
                    <span>{c.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

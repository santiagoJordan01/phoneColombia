import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Select con búsqueda (estilo Select2) para catálogos.
 * options: { value, label, sublabel? }
 */
export default function SearchSelect({
  value,
  onChange,
  options = [],
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  allowClear = true,
  clearLabel = "Sin selección",
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q)),
    );
  }, [options, search]);

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

  const pick = (next) => {
    onChange(next);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className={`inv-select2${disabled ? " is-disabled" : ""}`} ref={rootRef} id={id}>
      <button
        type="button"
        className={`inv-select2__trigger ${open ? "is-open" : ""}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="inv-select2__trigger-inner">
          <span className={selected ? "inv-select2__value" : "inv-select2__placeholder"}>
            {selected ? selected.label : placeholder}
          </span>
          {selected?.sublabel && (
            <span className="inv-select2__sublabel">{selected.sublabel}</span>
          )}
        </span>
        <span className="inv-select2__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="inv-select2__dropdown" role="listbox">
          <input
            type="text"
            className="inv-select2__search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <ul className="inv-select2__list">
            {allowClear && (
              <li>
                <button
                  type="button"
                  className={`inv-select2__option ${!value ? "is-selected" : ""}`}
                  onClick={() => pick("")}
                >
                  {clearLabel}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="inv-select2__empty">Sin resultados</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === o.value}
                    className={`inv-select2__option ${value === o.value ? "is-selected" : ""}`}
                    onClick={() => pick(o.value)}
                  >
                    <span>{o.label}</span>
                    {o.sublabel && <span className="inv-select2__option-sub">{o.sublabel}</span>}
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

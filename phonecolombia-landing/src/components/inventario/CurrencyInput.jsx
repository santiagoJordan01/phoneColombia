import { useEffect, useState } from "react";
import { formatCopInput, parseCop } from "../../lib/currencyCop.js";

export default function CurrencyInput({
  value,
  onChange,
  className = "inv-field__input inv-field__input--currency",
  placeholder = "$ 0",
  disabled = false,
  required = false,
  id,
  name,
}) {
  const [display, setDisplay] = useState(() => formatCopInput(value));

  useEffect(() => {
    setDisplay(formatCopInput(value));
  }, [value]);

  const handleChange = (event) => {
    const digits = event.target.value.replace(/[^\d]/g, "");
    if (!digits) {
      onChange("");
      setDisplay("");
      return;
    }
    const num = parseCop(digits);
    onChange(String(num));
    setDisplay(formatCopInput(num));
  };

  const handleFocus = (event) => {
    event.target.select();
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      id={id}
      name={name}
      autoComplete="off"
    />
  );
}

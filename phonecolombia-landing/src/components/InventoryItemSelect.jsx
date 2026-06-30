import React, { useMemo } from "react";
import SearchSelect from "./SearchSelect.jsx";
import { inventoryItemSelectOptions } from "../lib/inventarioSelectOptions.js";

export default function InventoryItemSelect({
  items = [],
  value,
  onChange,
  showSensitive = true,
  placeholder = "Buscar equipo…",
  searchPlaceholder = "Nombre, IMEI, código de barras…",
  allowClear = true,
  clearLabel = "Seleccionar…",
  disabled = false,
  id,
}) {
  const options = useMemo(
    () => inventoryItemSelectOptions(items, { showSensitive }),
    [items, showSensitive],
  );

  return (
    <SearchSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      allowClear={allowClear}
      clearLabel={clearLabel}
      disabled={disabled}
    />
  );
}

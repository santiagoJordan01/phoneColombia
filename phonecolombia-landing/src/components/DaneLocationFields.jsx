import React, { useMemo } from "react";
import SearchSelect from "./SearchSelect.jsx";
import { Field } from "../pages/inventario/shared.jsx";
import {
  departmentLabel,
  getDepartmentOptions,
  getMunicipalityOptions,
  municipalityLabel,
} from "../lib/daneLocations.js";

export default function DaneLocationFields({
  departmentCode = "",
  municipalityCode = "",
  onDepartmentChange,
  onMunicipalityChange,
  disabled = false,
}) {
  const departmentOptions = useMemo(() => getDepartmentOptions(), []);
  const municipalityOptions = useMemo(
    () => getMunicipalityOptions(departmentCode),
    [departmentCode],
  );

  return (
    <>
      <Field label="Departamento">
        <SearchSelect
          value={departmentCode}
          onChange={(code) => {
            onDepartmentChange(code);
            onMunicipalityChange("");
          }}
          options={departmentOptions}
          placeholder="Seleccionar departamento…"
          searchPlaceholder="Buscar departamento…"
          clearLabel="Sin departamento"
          disabled={disabled}
        />
      </Field>
      <Field label="Ciudad / Municipio">
        <SearchSelect
          value={municipalityCode}
          onChange={onMunicipalityChange}
          options={municipalityOptions}
          placeholder={departmentCode ? "Seleccionar municipio…" : "Primero elige departamento"}
          searchPlaceholder="Buscar ciudad…"
          clearLabel="Sin municipio"
          disabled={disabled || !departmentCode}
        />
        {municipalityCode && (
          <p className="inv-field__hint">
            Código DANE: <strong>{municipalityCode}</strong>
            {departmentCode ? ` · ${departmentLabel(departmentCode)}` : ""}
            {municipalityCode ? ` · ${municipalityLabel(municipalityCode)}` : ""}
          </p>
        )}
      </Field>
    </>
  );
}

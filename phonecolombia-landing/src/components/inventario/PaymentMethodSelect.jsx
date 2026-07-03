import React from "react";

/**
 * @param {{ value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, groups: Array<{ label?: string, methods: Array<{ value: string, label: string }> }>, className?: string, disabled?: boolean, required?: boolean }} props
 */
export default function PaymentMethodSelect({
  value,
  onChange,
  groups,
  className = "inv-field__input",
  disabled = false,
  required = false,
}) {
  return (
    <select
      className={className}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
    >
      {groups.map((group) =>
        group.label ? (
          <optgroup key={group.label} label={group.label}>
            {group.methods.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </optgroup>
        ) : (
          group.methods.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))
        ),
      )}
    </select>
  );
}

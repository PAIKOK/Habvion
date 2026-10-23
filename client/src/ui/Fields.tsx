import { useEffect, useState } from "react";
import type { Unit } from "@shared/types/home";
import { displayLength, feet } from "@shared/lib/units";
export function NumberField({
  label,
  value,
  onCommit,
  unit,
  min,
  step = 0.5,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  unit?: Unit;
  min?: number;
  step?: number;
}) {
  const shown = unit ? displayLength(value, unit) : value;
  const [text, setText] = useState(String(Number(shown.toFixed(3))));
  useEffect(() => setText(String(Number(shown.toFixed(3)))), [shown]);
  const commit = () => {
    const n = Number(text);
    if (text.trim() && Number.isFinite(n)) onCommit(unit ? feet(n, unit) : n);
    setText(String(Number(shown.toFixed(3))));
  };
  return (
    <label className="field">
      <span>
        {label}
        {unit && <small>{unit}</small>}
      </span>
      <input
        aria-label={label}
        type="number"
        min={min}
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
export function TextField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (s: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          onCommit(text);
          setText(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

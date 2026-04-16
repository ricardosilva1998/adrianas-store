import { FONT_FAMILIES } from "../../lib/fonts";

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
}

export default function FontPicker({ label, value, onChange }: Props) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input mt-1"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name} — {f.category}
          </option>
        ))}
      </select>
      <p className="mt-2 text-sm" style={{ fontFamily: `"${value}", ${getFallback(value)}` }}>
        A rápida raposa castanha salta sobre o cão preguiçoso — 1234567890
      </p>
    </div>
  );
}

function getFallback(name: string): string {
  return FONT_FAMILIES.find((f) => f.name === name)?.fallback ?? "system-ui, sans-serif";
}

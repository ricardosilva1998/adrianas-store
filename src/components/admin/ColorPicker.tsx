import { deriveScale, isValidHex, SHADE_KEYS } from "../../lib/theme-colors";

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  showScale?: boolean;
}

export default function ColorPicker({ label, value, onChange, showScale = true }: Props) {
  const valid = isValidHex(value);
  const scale = valid ? deriveScale(value) : null;

  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border border-ink-line"
          aria-label={`${label} — color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          className="field-input flex-1 uppercase"
          placeholder="#F691B4"
        />
      </div>
      {!valid && <p className="mt-1 text-xs text-red-600">Hex inválido</p>}
      {showScale && scale && (
        <div className="mt-2 flex gap-1">
          {SHADE_KEYS.map((k) => (
            <div
              key={k}
              className="h-6 flex-1 rounded"
              style={{ backgroundColor: scale[k] }}
              title={`${k}: ${scale[k]}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

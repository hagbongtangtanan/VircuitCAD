export const WIRE_COLORS = [
  { name: 'red', value: '#ef4444' },
  { name: 'black', value: '#111827' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'green', value: '#22c55e' },
  { name: 'yellow', value: '#eab308' },
  { name: 'orange', value: '#f97316' },
  { name: 'white', value: '#f8fafc' },
  { name: 'purple', value: '#a855f7' },
] as const;

export type WireColorPickerProps = {
  color: string;
  onChange: (color: string) => void;
};

/** 8-colour wire palette (docs/DESIGN.md 3.3). Colours come from CSS tokens. */
export function WireColorPicker({ color, onChange }: WireColorPickerProps) {
  return (
    <div className="wire-colors" role="group" aria-label="Wire colour" data-testid="wire-colors">
      {WIRE_COLORS.map((swatch) => (
        <button
          key={swatch.name}
          type="button"
          className={`wire-swatch wire-swatch--${swatch.name}`}
          data-testid={`wire-${swatch.name}`}
          aria-label={`Wire colour ${swatch.name}`}
          aria-pressed={swatch.value === color}
          title={swatch.name}
          onClick={() => onChange(swatch.value)}
        />
      ))}
    </div>
  );
}

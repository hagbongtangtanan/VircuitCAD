const PREFIXES: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
];

const UNIT_SYMBOLS: Record<string, string> = {
  ohm: 'Ω',
  '°C': '°C',
  C: '°C',
};

function trim(value: number): string {
  return `${Number(value.toFixed(3))}`;
}

function join(number: string, prefix: string, symbol: string): string {
  const unitText = `${prefix}${symbol}`;
  return unitText ? `${number} ${unitText}` : number;
}

/** Format a numeric quantity with an SI prefix and unit symbol (e.g. 220 Ω, 1 mA, 1 µF). */
export function formatQuantity(value: number, unit = ''): string {
  const symbol = UNIT_SYMBOLS[unit] ?? unit;
  if (!Number.isFinite(value)) return join('—', '', symbol);
  if (value === 0) return join('0', '', symbol);

  const abs = Math.abs(value);
  for (const [factor, prefix] of PREFIXES) {
    if (abs >= factor || factor === 1e-12) {
      return join(trim(value / factor), prefix, symbol);
    }
  }
  return join(`${value}`, '', symbol);
}

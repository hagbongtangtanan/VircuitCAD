import { extractNetlist } from '../board/netlist';
import type { Circuit, ParamValue } from '../model/circuit';
import type { PartRegistry } from '../parts/registry';

function formatValue(value: ParamValue): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const magnitude = Math.abs(value);
    if (magnitude !== 0 && (magnitude < 1e-3 || magnitude >= 1e6)) return value.toExponential();
    return String(value);
  }
  return String(value);
}

const PINS: Record<string, readonly [string, string]> = {
  resistor: ['a', 'b'],
  capacitor: ['a', 'b'],
  inductor: ['a', 'b'],
  battery: ['positive', 'negative'],
  'battery-pack': ['positive', 'negative'],
  'power-supply': ['positive', 'negative'],
};

const PREFIX: Record<string, string> = {
  resistor: 'R',
  capacitor: 'C',
  inductor: 'L',
  battery: 'V',
  'battery-pack': 'V',
  'power-supply': 'V',
};

const VALUE_PARAM: Record<string, string> = {
  resistor: 'resistance',
  capacitor: 'capacitance',
  inductor: 'inductance',
  battery: 'voltage',
  'battery-pack': 'voltage',
  'power-supply': 'voltage',
};

function nodeNumber(netName: string): number {
  if (netName === 'GND') return 0;
  const parsed = Number(netName.replace(/^N/, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Renders a SPICE netlist for the supported (linear source/passive) parts. */
export function toSpiceNetlist(circuit: Circuit, registry: PartRegistry): string {
  const netlist = extractNetlist(circuit, registry);
  const netOfPin = new Map<string, string>();
  for (const net of netlist.nets) {
    for (const pin of net.pins) netOfPin.set(`${pin.partId}:${pin.pinId}`, net.name);
  }
  const nodeOf = (partId: string, pinId: string): number => {
    const name = netOfPin.get(`${partId}:${pinId}`);
    return name === undefined ? 0 : nodeNumber(name);
  };

  const lines = [`* VircuitCAD netlist: ${circuit.name}`];
  for (const part of circuit.parts) {
    const manifest = registry.get(part.partId);
    if (!manifest) continue;
    const model = manifest.simModel;
    const pins = PINS[model];
    const prefix = PREFIX[model];
    const valueParam = VALUE_PARAM[model];
    if (!pins || !prefix || !valueParam) {
      lines.push(`* skipped ${part.id} (${part.partId})`);
      continue;
    }

    const param = part.params[valueParam];
    const value = param ?? manifest.params.find((spec) => spec.id === valueParam)?.default ?? 0;
    lines.push(
      `${prefix}${part.id} ${nodeOf(part.id, pins[0])} ${nodeOf(part.id, pins[1])} ${formatValue(value)}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

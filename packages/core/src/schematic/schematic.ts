import type { Netlist, TerminalRef } from '../board/netlist';
import type { Circuit } from '../model/circuit';
import type { PartRegistry } from '../parts/registry';

/** Pixel size of one schematic grid unit. */
export const SCHEMATIC_UNIT = 24;
const COLUMNS = 3;
const GAP_X = 7;
const GAP_Y = 5;

export type SchematicPin = {
  pinId: string;
  label: string;
  x: number;
  y: number;
  net: string;
};

export type SchematicNode = {
  partId: string;
  name: string;
  symbol: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: SchematicPin[];
};

export type SchematicNet = {
  name: string;
  isGround: boolean;
  label: string;
  pins: TerminalRef[];
};

export type SchematicLayout = {
  widthUnits: number;
  heightUnits: number;
  nodes: SchematicNode[];
  nets: SchematicNet[];
};

function pinKey(ref: TerminalRef): string {
  return `${ref.partId}:${ref.pinId}`;
}

/** Auto-layouts a read-only schematic from the netlist using manifest schematic symbols. */
export function layoutSchematic(
  circuit: Circuit,
  netlist: Netlist,
  registry: PartRegistry,
): SchematicLayout {
  const netOfPin = new Map<string, string>();
  for (const net of netlist.nets) {
    for (const pin of net.pins) netOfPin.set(pinKey(pin), net.name);
  }

  const nodes: SchematicNode[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let column = 0;
  let rowHeight = 0;

  for (const part of circuit.parts) {
    const manifest = registry.get(part.partId);
    const pins = manifest?.pins ?? [];
    const maxX = pins.reduce((max, pin) => Math.max(max, pin.position.x), 0);
    const maxY = pins.reduce((max, pin) => Math.max(max, pin.position.y), 1);
    const width = maxX + 4;
    const height = maxY + 3;

    nodes.push({
      partId: part.id,
      name: manifest?.name ?? part.partId,
      symbol: manifest?.schematicSymbol ?? 'generic',
      x: cursorX,
      y: cursorY,
      width,
      height,
      pins: pins.map((pin) => ({
        pinId: pin.id,
        label: pin.name,
        x: cursorX + pin.position.x + 1,
        y: cursorY + pin.position.y + 1,
        net: netOfPin.get(pinKey({ partId: part.id, pinId: pin.id })) ?? 'FLOATING',
      })),
    });

    rowHeight = Math.max(rowHeight, height);
    column += 1;
    if (column >= COLUMNS) {
      column = 0;
      cursorX = 0;
      cursorY += rowHeight + GAP_Y;
      rowHeight = 0;
    } else {
      cursorX += width + GAP_X;
    }
  }

  const widthUnits = Math.max(cursorX, ...nodes.map((node) => node.x + node.width), 0);
  const heightUnits = Math.max(cursorY, ...nodes.map((node) => node.y + node.height), 0);

  const nets: SchematicNet[] = netlist.nets.map((net) => ({
    name: net.name,
    isGround: net.isGround,
    label: net.isGround ? 'GND' : net.name,
    pins: net.pins.map((pin) => ({ partId: pin.partId, pinId: pin.pinId })),
  }));

  return { widthUnits, heightUnits, nodes, nets };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Renders a layout to a standalone SVG string (read-only schematic export). */
export function schematicToSvg(layout: SchematicLayout): string {
  const u = SCHEMATIC_UNIT;
  const margin = u;
  const width = Math.ceil(layout.widthUnits * u + margin * 2);
  const height = Math.ceil(layout.heightUnits * u + margin * 2);
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="monospace" font-size="11">`,
  );
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);

  for (const node of layout.nodes) {
    const x = node.x * u + margin;
    const y = node.y * u + margin;
    const w = node.width * u;
    const h = node.height * u;
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#334155"/>`);
    parts.push(
      `<text x="${x + 4}" y="${y + 14}" fill="#0f172a">${escapeXml(node.name)}</text>`,
    );
    for (const pin of node.pins) {
      const px = pin.x * u + margin;
      const py = pin.y * u + margin;
      parts.push(`<circle cx="${px}" cy="${py}" r="2.5" fill="#475569"/>`);
      parts.push(
        `<text x="${px + 5}" y="${py + 4}" fill="${pin.net === 'FLOATING' ? '#b91c1c' : '#475569'}">${escapeXml(pin.net)}</text>`,
      );
    }
  }

  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

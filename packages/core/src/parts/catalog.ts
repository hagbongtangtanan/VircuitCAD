import type { PartManifest } from './manifest';
import { PartRegistry, parsePartManifest } from './registry';

export const placeholderManifests: PartManifest[] = [
  parsePartManifest({
    id: 'resistor',
    name: 'Resistor',
    category: 'passive',
    pins: [
      { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'b', name: 'B', position: { x: 4, y: 0 }, role: 'passive' },
    ],
    params: [
      { id: 'resistance', label: 'Resistance', unit: 'ohm', min: 0.001, max: 1e9, default: 220 },
    ],
    simModel: 'resistor',
    svg: 'parts/resistor.svg',
  }),
  parsePartManifest({
    id: 'led',
    name: 'LED',
    category: 'opto',
    pins: [
      { id: 'anode', name: 'Anode', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'cathode', name: 'Cathode', position: { x: 2, y: 0 }, role: 'passive' },
    ],
    params: [
      { id: 'color', label: 'Color', default: 'red' },
      { id: 'forwardVoltage', label: 'Forward voltage', unit: 'V', min: 0.5, max: 5, default: 2 },
    ],
    simModel: 'led',
    svg: 'parts/led.svg',
  }),
  parsePartManifest({
    id: 'battery',
    name: 'Battery',
    category: 'power',
    pins: [
      { id: 'positive', name: '+', position: { x: 0, y: 0 }, role: 'power' },
      { id: 'negative', name: '-', position: { x: 2, y: 0 }, role: 'ground' },
    ],
    params: [{ id: 'voltage', label: 'Voltage', unit: 'V', min: 0.1, max: 24, default: 9 }],
    simModel: 'battery',
    svg: 'parts/battery.svg',
  }),
  parsePartManifest({
    id: 'battery-pack',
    name: '3xAA Pack',
    category: 'power',
    pins: [
      { id: 'positive', name: '+', position: { x: 0, y: 0 }, role: 'power' },
      { id: 'negative', name: '-', position: { x: 2, y: 0 }, role: 'ground' },
    ],
    params: [{ id: 'voltage', label: 'Voltage', unit: 'V', min: 0.1, max: 24, default: 4.5 }],
    simModel: 'battery-pack',
    svg: 'parts/battery-pack.svg',
  }),
  parsePartManifest({
    id: 'pushbutton',
    name: 'Pushbutton',
    category: 'digital',
    pins: [
      { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'b', name: 'B', position: { x: 2, y: 0 }, role: 'passive' },
    ],
    params: [{ id: 'pressed', label: 'Pressed', default: false }],
    simModel: 'pushbutton',
    svg: 'parts/pushbutton.svg',
  }),
  parsePartManifest({
    id: 'slide-switch',
    name: 'Slide Switch',
    category: 'digital',
    pins: [
      { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'b', name: 'B', position: { x: 2, y: 0 }, role: 'passive' },
    ],
    params: [{ id: 'closed', label: 'Closed', default: true }],
    simModel: 'slide-switch',
    svg: 'parts/slide-switch.svg',
  }),
  parsePartManifest({
    id: 'capacitor',
    name: 'Capacitor',
    category: 'passive',
    pins: [
      { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'b', name: 'B', position: { x: 2, y: 0 }, role: 'passive' },
    ],
    params: [
      { id: 'capacitance', label: 'Capacitance', unit: 'F', min: 1e-12, max: 1, default: 1e-6 },
    ],
    simModel: 'capacitor',
    svg: 'parts/capacitor.svg',
  }),
  parsePartManifest({
    id: 'inductor',
    name: 'Inductor',
    category: 'passive',
    pins: [
      { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'b', name: 'B', position: { x: 2, y: 0 }, role: 'passive' },
    ],
    params: [
      { id: 'inductance', label: 'Inductance', unit: 'H', min: 1e-9, max: 100, default: 1e-3 },
    ],
    simModel: 'inductor',
    svg: 'parts/inductor.svg',
  }),
  parsePartManifest({
    id: 'power-supply',
    name: 'Bench Supply',
    category: 'power',
    pins: [
      { id: 'positive', name: '+', position: { x: 0, y: 0 }, role: 'power' },
      { id: 'negative', name: '-', position: { x: 2, y: 0 }, role: 'ground' },
    ],
    params: [
      { id: 'voltage', label: 'Voltage', unit: 'V', min: 0.1, max: 24, default: 5 },
      { id: 'currentLimit', label: 'Current limit', unit: 'A', min: 0.001, max: 5, default: 1 },
    ],
    simModel: 'power-supply',
    svg: 'parts/power-supply.svg',
  }),
  parsePartManifest({
    id: 'multimeter',
    name: 'Multimeter',
    category: 'instrument',
    pins: [
      { id: 'probe+', name: 'VΩA+', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'probe-', name: 'COM', position: { x: 2, y: 0 }, role: 'passive' },
    ],
    params: [{ id: 'mode', label: 'Mode', default: 'V' }],
    simModel: 'multimeter',
    svg: 'parts/multimeter.svg',
  }),
];

export function createDefaultPartRegistry(): PartRegistry {
  return new PartRegistry(placeholderManifests);
}

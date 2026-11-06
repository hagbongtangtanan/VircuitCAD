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
];

export function createDefaultPartRegistry(): PartRegistry {
  return new PartRegistry(placeholderManifests);
}

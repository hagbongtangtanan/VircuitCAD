import { expect, it } from 'vitest';

import { hcSr04Distance, hcSr04EchoMicros, tmp36Temperature, tmp36Voltage } from './sensors2';

it('converts TMP36 voltage and temperature', () => {
  expect(tmp36Voltage(25)).toBeCloseTo(0.75);
  expect(tmp36Temperature(0.75)).toBeCloseTo(25);
  expect(tmp36Voltage(0)).toBeCloseTo(0.5);
});

it('converts HC-SR04 echo time and distance', () => {
  // 10 cm -> ~583 µs round trip
  expect(hcSr04EchoMicros(10)).toBeCloseTo(583, 0);
  expect(hcSr04Distance(hcSr04EchoMicros(10))).toBeCloseTo(10, 6);
});

import { expect, it } from 'vitest';

import { astable555, monostable555 } from './timer555';

it('matches the astable 555 formula within 5%', () => {
  const r1 = 1000;
  const r2 = 68_000;
  const c = 10e-6;
  const { frequency, duty } = astable555(r1, r2, c);

  const expectedFrequency = 1.44 / ((r1 + 2 * r2) * c);
  const expectedDuty = (r1 + r2) / (r1 + 2 * r2);

  expect(Math.abs(frequency - expectedFrequency) / expectedFrequency).toBeLessThan(0.05);
  expect(Math.abs(duty - expectedDuty) / expectedDuty).toBeLessThan(0.05);
});

it('matches the monostable pulse-width formula', () => {
  expect(monostable555(10_000, 100e-6)).toBeCloseTo(1.1, 6);
});

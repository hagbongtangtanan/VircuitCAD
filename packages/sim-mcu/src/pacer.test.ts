import { expect, it } from 'vitest';

import { Pacer } from './pacer';

it('advances simulated time at real time by default', () => {
  const pacer = new Pacer();
  expect(pacer.tick(1000).micros).toBe(0);
  const tick = pacer.tick(1016);
  expect(tick.micros).toBe(16_000);
  expect(tick.realTimeFactor).toBeCloseTo(1);
  expect(tick.overloaded).toBe(false);
});

it('caps the backlog and reports overload on a long gap', () => {
  const pacer = new Pacer({ maxFrameMicros: 50_000 });
  pacer.tick(0);
  const tick = pacer.tick(1000); // a 1 s hiccup
  expect(tick.micros).toBe(50_000);
  expect(tick.overloaded).toBe(true);
  expect(tick.realTimeFactor).toBeLessThan(1);
});

it('honours the speed factor', () => {
  const pacer = new Pacer({ speed: 0.5 });
  pacer.tick(0);
  expect(pacer.tick(16).micros).toBe(8_000);
  pacer.setSpeed(2);
  expect(pacer.tick(32).micros).toBe(32_000);
});

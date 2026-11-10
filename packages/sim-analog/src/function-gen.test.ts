import { expect, it } from 'vitest';

import { sampleWaveform } from './function-gen';

it('samples a sine with amplitude and offset', () => {
  const options = { waveform: 'sine' as const, frequency: 1, amplitude: 2, offset: 1 };
  expect(sampleWaveform(options, 0)).toBeCloseTo(1);
  expect(sampleWaveform(options, 0.25)).toBeCloseTo(3);
  expect(sampleWaveform(options, 0.75)).toBeCloseTo(-1);
});

it('samples a square wave', () => {
  const options = { waveform: 'square' as const, frequency: 1, amplitude: 5 };
  expect(sampleWaveform(options, 0.1)).toBe(5);
  expect(sampleWaveform(options, 0.6)).toBe(-5);
});

it('samples a triangle between -amp and +amp', () => {
  const options = { waveform: 'triangle' as const, frequency: 1, amplitude: 2 };
  expect(sampleWaveform(options, 0)).toBeCloseTo(-2);
  expect(sampleWaveform(options, 0.5)).toBeCloseTo(2);
  expect(sampleWaveform(options, 0.25)).toBeCloseTo(0);
});

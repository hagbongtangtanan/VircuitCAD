import { expect, it } from 'vitest';

import { defaultCapabilities, unavailableReason } from './capabilities';

it('defaults to all capabilities enabled', () => {
  expect(defaultCapabilities()).toEqual({ simulation: true, codeEditor: true, compile: true });
});

it('explains why a capability is unavailable', () => {
  expect(unavailableReason('simulation')).toMatch(/Simulation/);
  expect(unavailableReason('codeEditor')).toMatch(/code editor/i);
  expect(unavailableReason('compile')).toMatch(/Compiling/);
});

import { expect, it } from 'vitest';

import { defaultCapabilities, unavailableReason } from './capabilities';

it('enables implemented capabilities and disables unavailable serial sending', () => {
  expect(defaultCapabilities()).toEqual({
    simulation: true,
    codeEditor: true,
    codeActions: true,
    compile: true,
    serialSend: false,
  });
});

it('explains why a capability is unavailable', () => {
  expect(unavailableReason('simulation')).toMatch(/Simulation/);
  expect(unavailableReason('codeEditor')).toMatch(/code editor/i);
  expect(unavailableReason('codeActions')).toMatch(/Code actions/);
  expect(unavailableReason('compile')).toMatch(/Compiling/);
  expect(unavailableReason('serialSend')).toMatch(/serial data/i);
});

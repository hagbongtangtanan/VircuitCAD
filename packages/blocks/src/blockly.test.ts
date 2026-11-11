// @vitest-environment jsdom
import * as Blockly from 'blockly/core';
import { expect, it } from 'vitest';

import { registerArduinoBlocks, workspaceToProgram } from './blockly';
import { generateArduino } from './generate';

const SERIALIZATION = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'arduino_setup',
        id: 'setup-1',
        x: 0,
        y: 0,
        inputs: {
          DO: {
            block: {
              type: 'io_pin_mode',
              id: 'pin-1',
              fields: { PIN: 13, MODE: 'OUTPUT' },
            },
          },
        },
      },
      {
        type: 'arduino_loop',
        id: 'loop-1',
        x: 0,
        y: 200,
        inputs: {
          DO: {
            block: {
              type: 'time_delay',
              id: 'delay-1',
              inputs: {
                MS: { block: { type: 'math_number', id: 'num-1', fields: { NUM: 500 } } },
              },
            },
          },
        },
      },
    ],
  },
};

it('loads a serialized Blockly workspace offline and generates C++', () => {
  registerArduinoBlocks();
  const workspace = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(SERIALIZATION, workspace);

  const code = generateArduino(workspaceToProgram(workspace));

  expect(code).toContain('pinMode(13, OUTPUT);');
  expect(code).toContain('delay(500);');
});

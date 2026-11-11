import { binary, number, variable, type Program } from './ir';

/**
 * The five reference programs used for blocks↔text parity. The IR mirrors what
 * `workspaceToProgram` produces for the equivalent Blockly workspace; `generateArduino`
 * output is compared against the handwritten sketches in `fixtures/blocks/`.
 */
export const REFERENCE_PROGRAMS: ReadonlyArray<{ name: string; program: Program }> = [
  {
    name: 'blink',
    program: {
      setup: [{ kind: 'pinMode', pin: 13, mode: 'OUTPUT' }],
      loop: [
        { kind: 'digitalWrite', pin: 13, value: 'HIGH' },
        { kind: 'delay', ms: number(500) },
        { kind: 'digitalWrite', pin: 13, value: 'LOW' },
        { kind: 'delay', ms: number(500) },
      ],
    },
  },
  {
    name: 'fade',
    program: {
      setup: [{ kind: 'pinMode', pin: 9, mode: 'OUTPUT' }],
      loop: [
        {
          kind: 'forRange',
          variable: 'i',
          from: number(0),
          to: number(255),
          step: number(5),
          body: [
            { kind: 'analogWrite', pin: 9, value: variable('i') },
            { kind: 'delay', ms: number(10) },
          ],
        },
      ],
    },
  },
  {
    name: 'servo',
    program: {
      setup: [],
      loop: [
        {
          kind: 'forRange',
          variable: 'angle',
          from: number(0),
          to: number(180),
          step: number(1),
          body: [
            { kind: 'servoWrite', pin: 9, angle: variable('angle') },
            { kind: 'delay', ms: number(15) },
          ],
        },
      ],
    },
  },
  {
    name: 'lcd',
    program: {
      setup: [],
      loop: [
        { kind: 'lcdSetCursor', column: 0, row: 0 },
        { kind: 'lcdPrint', text: 'VircuitCAD' },
      ],
    },
  },
  {
    name: 'serial',
    program: {
      setup: [{ kind: 'varSet', name: 'n', value: number(0) }],
      loop: [
        { kind: 'serialPrint', value: variable('n') },
        { kind: 'varSet', name: 'n', value: binary('+', variable('n'), number(1)) },
        { kind: 'delay', ms: number(1000) },
      ],
    },
  },
];

import { expect, it } from 'vitest';

import { generateArduino } from './generate';
import { workspaceToProgram, type BlockLike, type WorkspaceLike } from './mapper';

class FakeBlock implements BlockLike {
  constructor(
    readonly type: string,
    private readonly fields: Record<string, unknown> = {},
    private readonly inputs: Record<string, FakeBlock | null> = {},
    private next: FakeBlock | null = null,
  ) {}

  setNext(block: FakeBlock | null): this {
    this.next = block;
    return this;
  }

  getFieldValue(name: string): unknown {
    return this.fields[name];
  }

  getInputTargetBlock(name: string): BlockLike | null {
    return this.inputs[name] ?? null;
  }

  getNextBlock(): BlockLike | null {
    return this.next;
  }
}

function chain(...blocks: FakeBlock[]): FakeBlock | null {
  for (let index = 0; index < blocks.length - 1; index += 1) {
    blocks[index]?.setNext(blocks[index + 1] ?? null);
  }
  return blocks[0] ?? null;
}

function workspace(...tops: FakeBlock[]): WorkspaceLike {
  return { getTopBlocks: () => tops };
}

it('maps a blink workspace (setup + loop) to C++', () => {
  const setup = new FakeBlock('arduino_setup', {}, { DO: new FakeBlock('io_pin_mode', { PIN: 13, MODE: 'OUTPUT' }) });
  const loop = new FakeBlock(
    'arduino_loop',
    {},
    {
      DO: chain(
        new FakeBlock('io_digital_write', { PIN: 13, STATE: 'HIGH' }),
        new FakeBlock('time_delay', { MS: undefined }, { MS: new FakeBlock('math_number', { NUM: 500 }) }),
        new FakeBlock('io_digital_write', { PIN: 13, STATE: 'LOW' }),
        new FakeBlock('time_delay', {}, { MS: new FakeBlock('math_number', { NUM: 500 }) }),
      ),
    },
  );

  const code = generateArduino(workspaceToProgram(workspace(setup, loop)));

  expect(code).toContain('pinMode(13, OUTPUT);');
  expect(code).toContain('digitalWrite(13, HIGH);');
  expect(code).toContain('delay(500);');
  expect(code).toContain('digitalWrite(13, LOW);');
});

it('maps logic, variables and loops', () => {
  const loop = new FakeBlock(
    'arduino_loop',
    {},
    {
      DO: chain(
        new FakeBlock(
          'controls_if',
          {},
          {
            IF0: new FakeBlock(
              'logic_compare',
              { OP: 'GT' },
              { A: new FakeBlock('variables_get', { VAR: 'i' }), B: new FakeBlock('math_number', { NUM: 5 }) },
            ),
            DO0: new FakeBlock('lcd_print', { TEXT: 'big' }),
            DO1: new FakeBlock('lcd_print', { TEXT: 'small' }),
          },
        ),
        new FakeBlock(
          'controls_for',
          { VAR: 'i' },
          {
            FROM: new FakeBlock('math_number', { NUM: 0 }),
            TO: new FakeBlock('math_number', { NUM: 10 }),
            BY: new FakeBlock('math_number', { NUM: 1 }),
            DO: new FakeBlock('serial_print', {}, { VALUE: new FakeBlock('variables_get', { VAR: 'i' }) }),
          },
        ),
      ),
    },
  );

  const code = generateArduino(workspaceToProgram(workspace(loop)));

  expect(code).toContain('if ((i > 5)) {');
  expect(code).toContain('lcd.print("big");');
  expect(code).toContain('} else {');
  expect(code).toContain('lcd.print("small");');
  expect(code).toContain('int i = 0;');
  expect(code).toContain('for (int i = 0; i <= 10; i += 1) {');
  expect(code).toContain('Serial.println(i);');
});

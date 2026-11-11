import {
  boolean,
  number,
  text,
  variable,
  type BinaryOperator,
  type Expr,
  type Program,
  type Statement,
} from './ir';

/**
 * Minimal structural view of a Blockly workspace/block, so the mapper is unit-testable
 * without Blockly (and stays out of the pure `sim-*` boundary rules). A real Blockly
 * workspace satisfies these interfaces.
 */
export type BlockLike = {
  type: string;
  getFieldValue(name: string): unknown;
  getInputTargetBlock(name: string): BlockLike | null;
  getNextBlock(): BlockLike | null;
};

export type WorkspaceLike = {
  getTopBlocks(ordered?: boolean): BlockLike[];
};

function fieldNumber(block: BlockLike, name: string, fallback = 0): number {
  const value = block.getFieldValue(name);
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function fieldString(block: BlockLike, name: string, fallback = ''): string {
  const value = block.getFieldValue(name);
  return typeof value === 'string' ? value : fallback;
}

const ARITHMETIC: Record<string, BinaryOperator> = {
  ADD: '+',
  MINUS: '-',
  MULTIPLY: '*',
  DIVIDE: '/',
};

const COMPARISON: Record<string, BinaryOperator> = {
  EQ: '==',
  NEQ: '!=',
  LT: '<',
  LTE: '<=',
  GT: '>',
  GTE: '>=',
};

function expression(block: BlockLike | null): Expr {
  if (!block) return number(0);
  switch (block.type) {
    case 'math_number':
      return number(fieldNumber(block, 'NUM'));
    case 'text':
      return text(fieldString(block, 'TEXT'));
    case 'logic_boolean':
      return boolean(fieldString(block, 'BOOL') === 'TRUE');
    case 'variables_get':
      return variable(fieldString(block, 'VAR', 'item'));
    case 'math_arithmetic': {
      const op = ARITHMETIC[fieldString(block, 'OP', 'ADD')] ?? '+';
      return {
        kind: 'binary',
        op,
        left: expression(block.getInputTargetBlock('A')),
        right: expression(block.getInputTargetBlock('B')),
      };
    }
    case 'math_modulo':
      return {
        kind: 'binary',
        op: '%',
        left: expression(block.getInputTargetBlock('DIVIDEND')),
        right: expression(block.getInputTargetBlock('DIVISOR')),
      };
    case 'logic_compare': {
      const op = COMPARISON[fieldString(block, 'OP', 'EQ')] ?? '==';
      return {
        kind: 'binary',
        op,
        left: expression(block.getInputTargetBlock('A')),
        right: expression(block.getInputTargetBlock('B')),
      };
    }
    case 'logic_operation': {
      const op: BinaryOperator = fieldString(block, 'OP', 'AND') === 'OR' ? '||' : '&&';
      return {
        kind: 'binary',
        op,
        left: expression(block.getInputTargetBlock('A')),
        right: expression(block.getInputTargetBlock('B')),
      };
    }
    case 'logic_negate':
      return { kind: 'unary', op: '!', value: expression(block.getInputTargetBlock('BOOL')) };
    case 'io_digital_read':
      return { kind: 'pinRead', pin: fieldNumber(block, 'PIN') };
    default:
      return number(0);
  }
}

function statementsFrom(first: BlockLike | null): Statement[] {
  const statements: Statement[] = [];
  let block = first;
  while (block) {
    const statement = statementFrom(block);
    if (statement) statements.push(statement);
    block = block.getNextBlock();
  }
  return statements;
}

function ifStatement(block: BlockLike): Statement {
  const condition = expression(block.getInputTargetBlock('IF0'));
  const then = statementsFrom(block.getInputTargetBlock('DO0'));
  const elseHead = block.getInputTargetBlock('IF1');
  const elseBody = statementsFrom(block.getInputTargetBlock('DO1'));
  if (elseHead) {
    return { kind: 'if', condition, then, otherwise: [ifStatement(elseHead)] };
  }
  if (elseBody.length > 0) {
    return { kind: 'if', condition, then, otherwise: elseBody };
  }
  return { kind: 'if', condition, then };
}

function statementFrom(block: BlockLike): Statement | null {
  switch (block.type) {
    case 'io_pin_mode':
      return {
        kind: 'pinMode',
        pin: fieldNumber(block, 'PIN'),
        mode: fieldString(block, 'MODE', 'OUTPUT') as 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP',
      };
    case 'io_digital_write':
      return {
        kind: 'digitalWrite',
        pin: fieldNumber(block, 'PIN'),
        value: fieldString(block, 'STATE', 'LOW') === 'HIGH' ? 'HIGH' : 'LOW',
      };
    case 'io_analog_write':
      return {
        kind: 'analogWrite',
        pin: fieldNumber(block, 'PIN'),
        value: expression(block.getInputTargetBlock('VALUE')),
      };
    case 'time_delay':
      return { kind: 'delay', ms: expression(block.getInputTargetBlock('MS')) };
    case 'serial_print':
      return { kind: 'serialPrint', value: expression(block.getInputTargetBlock('VALUE')) };
    case 'servo_write':
      return {
        kind: 'servoWrite',
        pin: fieldNumber(block, 'PIN'),
        angle: expression(block.getInputTargetBlock('ANGLE')),
      };
    case 'lcd_set_cursor':
      return {
        kind: 'lcdSetCursor',
        column: fieldNumber(block, 'COLUMN'),
        row: fieldNumber(block, 'ROW'),
      };
    case 'lcd_print':
      return { kind: 'lcdPrint', text: fieldString(block, 'TEXT') };
    case 'lcd_clear':
      return { kind: 'lcdClear' };
    case 'variables_set':
      return {
        kind: 'varSet',
        name: fieldString(block, 'VAR', 'item'),
        value: expression(block.getInputTargetBlock('VALUE')),
      };
    case 'math_change': {
      const name = fieldString(block, 'VAR', 'item');
      return {
        kind: 'varSet',
        name,
        value: {
          kind: 'binary',
          op: '+',
          left: variable(name),
          right: expression(block.getInputTargetBlock('DELTA')),
        },
      };
    }
    case 'controls_repeat_ext':
      return {
        kind: 'repeat',
        times: expression(block.getInputTargetBlock('TIMES')),
        body: statementsFrom(block.getInputTargetBlock('DO')),
      };
    case 'controls_for':
      return {
        kind: 'forRange',
        variable: fieldString(block, 'VAR', 'i'),
        from: expression(block.getInputTargetBlock('FROM')),
        to: expression(block.getInputTargetBlock('TO')),
        step: expression(block.getInputTargetBlock('BY')),
        body: statementsFrom(block.getInputTargetBlock('DO')),
      };
    case 'controls_if':
      return ifStatement(block);
    default:
      return null;
  }
}

function topBlock(workspace: WorkspaceLike, type: string): BlockLike | null {
  return workspace.getTopBlocks(true).find((block) => block.type === type) ?? null;
}

/** Maps a workspace containing `arduino_setup`/`arduino_loop` blocks to the generator IR. */
export function workspaceToProgram(workspace: WorkspaceLike): Program {
  const setup = topBlock(workspace, 'arduino_setup');
  const loop = topBlock(workspace, 'arduino_loop');
  return {
    setup: statementsFrom(setup?.getInputTargetBlock('DO') ?? null),
    loop: statementsFrom(loop?.getInputTargetBlock('DO') ?? null),
  };
}

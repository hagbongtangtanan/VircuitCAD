/** A minimal, Blockly-agnostic program IR that the Arduino generator consumes. */

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '<'
  | '>'
  | '<='
  | '>='
  | '=='
  | '!='
  | '&&'
  | '||';

export type UnaryOperator = '!' | '-';

export type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'text'; value: string }
  | { kind: 'var'; name: string }
  | { kind: 'pinRead'; pin: number }
  | { kind: 'unary'; op: UnaryOperator; value: Expr }
  | { kind: 'binary'; op: BinaryOperator; left: Expr; right: Expr };

export type Statement =
  | { kind: 'delay'; ms: Expr }
  | { kind: 'pinMode'; pin: number; mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' }
  | { kind: 'digitalWrite'; pin: number; value: 'HIGH' | 'LOW' }
  | { kind: 'analogWrite'; pin: number; value: Expr }
  | { kind: 'serialPrint'; value: Expr }
  | { kind: 'varSet'; name: string; value: Expr }
  | { kind: 'servoWrite'; pin: number; angle: Expr }
  | { kind: 'lcdSetCursor'; column: number; row: number }
  | { kind: 'lcdPrint'; text: string }
  | { kind: 'lcdClear' }
  | { kind: 'forRange'; variable: string; from: Expr; to: Expr; step: Expr; body: Statement[] }
  | { kind: 'repeat'; times: Expr; body: Statement[] }
  | { kind: 'if'; condition: Expr; then: Statement[]; otherwise?: Statement[] };

export type Program = {
  setup: Statement[];
  loop: Statement[];
};

export const number = (value: number): Expr => ({ kind: 'number', value });
export const boolean = (value: boolean): Expr => ({ kind: 'boolean', value });
export const text = (value: string): Expr => ({ kind: 'text', value });
export const variable = (name: string): Expr => ({ kind: 'var', name });
export const unary = (op: UnaryOperator, value: Expr): Expr => ({ kind: 'unary', op, value });
export const binary = (op: BinaryOperator, left: Expr, right: Expr): Expr => ({
  kind: 'binary',
  op,
  left,
  right,
});

/** A minimal, Blockly-agnostic program IR that the Arduino generator consumes. */

export type BinaryOperator = '+' | '-' | '*' | '/' | '%' | '<' | '>' | '<=' | '>=' | '==' | '!=';

export type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'var'; name: string }
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
  | { kind: 'repeat'; times: Expr; body: Statement[] };

export type Program = {
  setup: Statement[];
  loop: Statement[];
};

export const number = (value: number): Expr => ({ kind: 'number', value });
export const variable = (name: string): Expr => ({ kind: 'var', name });
export const binary = (op: BinaryOperator, left: Expr, right: Expr): Expr => ({
  kind: 'binary',
  op,
  left,
  right,
});

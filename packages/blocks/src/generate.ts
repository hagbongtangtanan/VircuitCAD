import type { Expr, Program, Statement } from './ir';

const INDENT = '  ';
const LCD_PINS = '12, 11, 5, 4, 3, 2';

export function generateExpression(expression: Expr): string {
  switch (expression.kind) {
    case 'number':
      return String(expression.value);
    case 'boolean':
      return expression.value ? 'true' : 'false';
    case 'text':
      return JSON.stringify(expression.value);
    case 'var':
      return expression.name;
    case 'pinRead':
      return `digitalRead(${expression.pin})`;
    case 'unary':
      return `(${expression.op}${generateExpression(expression.value)})`;
    case 'binary':
      return `(${generateExpression(expression.left)} ${expression.op} ${generateExpression(expression.right)})`;
  }
}

type Features = {
  serial: boolean;
  lcd: boolean;
  servoPins: number[];
  variables: string[];
};

function scan(program: Program): Features {
  const servoPins = new Set<number>();
  const variables = new Set<string>();
  let serial = false;
  let lcd = false;

  const walk = (statements: readonly Statement[]): void => {
    for (const statement of statements) {
      switch (statement.kind) {
        case 'serialPrint':
          serial = true;
          break;
        case 'servoWrite':
          servoPins.add(statement.pin);
          break;
        case 'lcdPrint':
        case 'lcdSetCursor':
        case 'lcdClear':
          lcd = true;
          break;
        case 'varSet':
          variables.add(statement.name);
          break;
        case 'forRange':
          variables.add(statement.variable);
          walk(statement.body);
          break;
        case 'repeat':
          walk(statement.body);
          break;
        case 'if':
          walk(statement.then);
          if (statement.otherwise) walk(statement.otherwise);
          break;
        default:
          break;
      }
    }
  };

  walk(program.setup);
  walk(program.loop);

  return {
    serial,
    lcd,
    servoPins: [...servoPins].sort((a, b) => a - b),
    variables: [...variables],
  };
}

function emitStatement(statement: Statement, depth: number): string[] {
  const pad = INDENT.repeat(depth);
  switch (statement.kind) {
    case 'delay':
      return [`${pad}delay(${generateExpression(statement.ms)});`];
    case 'pinMode':
      return [`${pad}pinMode(${statement.pin}, ${statement.mode});`];
    case 'digitalWrite':
      return [`${pad}digitalWrite(${statement.pin}, ${statement.value});`];
    case 'analogWrite':
      return [`${pad}analogWrite(${statement.pin}, ${generateExpression(statement.value)});`];
    case 'serialPrint':
      return [`${pad}Serial.println(${generateExpression(statement.value)});`];
    case 'varSet':
      return [`${pad}${statement.name} = ${generateExpression(statement.value)};`];
    case 'servoWrite':
      return [`${pad}servo_${statement.pin}.write(${generateExpression(statement.angle)});`];
    case 'lcdSetCursor':
      return [`${pad}lcd.setCursor(${statement.column}, ${statement.row});`];
    case 'lcdPrint':
      return [`${pad}lcd.print(${JSON.stringify(statement.text)});`];
    case 'lcdClear':
      return [`${pad}lcd.clear();`];
    case 'forRange': {
      const header = `${pad}for (int ${statement.variable} = ${generateExpression(statement.from)}; ${statement.variable} <= ${generateExpression(statement.to)}; ${statement.variable} += ${generateExpression(statement.step)}) {`;
      const body = statement.body.flatMap((child) => emitStatement(child, depth + 1));
      return [header, ...body, `${pad}}`];
    }
    case 'repeat': {
      const header = `${pad}for (int i = 0; i < ${generateExpression(statement.times)}; i++) {`;
      const body = statement.body.flatMap((child) => emitStatement(child, depth + 1));
      return [header, ...body, `${pad}}`];
    }
    case 'if': {
      const header = `${pad}if (${generateExpression(statement.condition)}) {`;
      const thenBody = statement.then.flatMap((child) => emitStatement(child, depth + 1));
      if (!statement.otherwise || statement.otherwise.length === 0) {
        return [header, ...thenBody, `${pad}}`];
      }
      const elseBody = statement.otherwise.flatMap((child) => emitStatement(child, depth + 1));
      return [header, ...thenBody, `${pad}} else {`, ...elseBody, `${pad}}`];
    }
  }
}

/** Generates compilable Arduino C++ for the given program using only core + bundled libraries. */
export function generateArduino(program: Program): string {
  const features = scan(program);
  const lines: string[] = [];

  if (features.servoPins.length > 0) lines.push('#include <Servo.h>');
  if (features.lcd) lines.push('#include <LiquidCrystal.h>');
  if (lines.length > 0) lines.push('');

  for (const name of features.variables) lines.push(`int ${name} = 0;`);
  for (const pin of features.servoPins) lines.push(`Servo servo_${pin};`);
  if (features.lcd) lines.push(`LiquidCrystal lcd(${LCD_PINS});`);
  if (features.variables.length > 0 || features.servoPins.length > 0 || features.lcd) lines.push('');

  lines.push('void setup() {');
  if (features.serial) lines.push('  Serial.begin(9600);');
  for (const pin of features.servoPins) lines.push(`  servo_${pin}.attach(${pin});`);
  if (features.lcd) lines.push('  lcd.begin(16, 2);');
  for (const statement of program.setup) lines.push(...emitStatement(statement, 1));
  lines.push('}', '');

  lines.push('void loop() {');
  for (const statement of program.loop) lines.push(...emitStatement(statement, 1));
  lines.push('}');

  return `${lines.join('\n')}\n`;
}

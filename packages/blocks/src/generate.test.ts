import { expect, it } from 'vitest';

import { generateArduino } from './generate';
import { binary, number, variable, type Program } from './ir';

it('generates a blink sketch with no includes', () => {
  const program: Program = {
    setup: [{ kind: 'pinMode', pin: 13, mode: 'OUTPUT' }],
    loop: [
      { kind: 'digitalWrite', pin: 13, value: 'HIGH' },
      { kind: 'delay', ms: number(500) },
      { kind: 'digitalWrite', pin: 13, value: 'LOW' },
      { kind: 'delay', ms: number(500) },
    ],
  };

  expect(generateArduino(program)).toBe(
    [
      'void setup() {',
      '  pinMode(13, OUTPUT);',
      '}',
      '',
      'void loop() {',
      '  digitalWrite(13, HIGH);',
      '  delay(500);',
      '  digitalWrite(13, LOW);',
      '  delay(500);',
      '}',
      '',
    ].join('\n'),
  );
});

it('adds and attaches the Servo library', () => {
  const output = generateArduino({
    setup: [],
    loop: [{ kind: 'servoWrite', pin: 9, angle: number(90) }],
  });

  expect(output).toContain('#include <Servo.h>');
  expect(output).toContain('Servo servo_9;');
  expect(output).toContain('servo_9.attach(9);');
  expect(output).toContain('servo_9.write(90);');
});

it('adds the LiquidCrystal library and setup', () => {
  const output = generateArduino({
    setup: [],
    loop: [
      { kind: 'lcdSetCursor', column: 0, row: 1 },
      { kind: 'lcdPrint', text: 'VircuitCAD' },
    ],
  });

  expect(output).toContain('#include <LiquidCrystal.h>');
  expect(output).toContain('LiquidCrystal lcd(12, 11, 5, 4, 3, 2);');
  expect(output).toContain('lcd.begin(16, 2);');
  expect(output).toContain('lcd.setCursor(0, 1);');
  expect(output).toContain('lcd.print("VircuitCAD");');
});

it('starts Serial only when printing', () => {
  const output = generateArduino({
    setup: [],
    loop: [{ kind: 'serialPrint', value: number(42) }],
  });
  expect(output).toContain('Serial.begin(9600);');
  expect(output).toContain('Serial.println(42);');
});

it('declares loop variables and emits nested bodies', () => {
  const output = generateArduino({
    setup: [],
    loop: [
      {
        kind: 'forRange',
        variable: 'i',
        from: number(0),
        to: number(10),
        step: number(1),
        body: [{ kind: 'delay', ms: number(100) }],
      },
    ],
  });

  expect(output).toContain('int i = 0;');
  expect(output).toContain('for (int i = 0; i <= 10; i += 1) {');
  expect(output).toContain('    delay(100);');
});

it('emits binary expressions with parentheses', () => {
  const output = generateArduino({
    setup: [{ kind: 'varSet', name: 'x', value: number(0) }],
    loop: [{ kind: 'analogWrite', pin: 3, value: binary('+', variable('x'), number(5)) }],
  });

  expect(output).toContain('int x = 0;');
  expect(output).toContain('analogWrite(3, (x + 5));');
});

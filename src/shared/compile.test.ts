import { describe, expect, it } from 'vitest'
import {
  blankLiterals,
  buildTranslationUnit,
  collectPrototypes,
  parseCompilerOutput,
  parseSizeOutput,
  stripDefaultArguments,
} from './compile'

describe('blankLiterals', () => {
  it('keeps the length and the line structure', () => {
    const source = 'a // comment\nb /* block\nblock */ c'
    const blanked = blankLiterals(source)
    expect(blanked).toHaveLength(source.length)
    expect(blanked.split('\n')).toHaveLength(source.split('\n').length)
  })

  it('removes code-looking text from comments and strings', () => {
    const blanked = blankLiterals('f("void g() {}") // void h() {}')
    expect(blanked).not.toContain('g()')
    expect(blanked).not.toContain('h()')
  })

  it('does not treat an escaped quote as the end of a string', () => {
    const blanked = blankLiterals('x = "a\\"b" ; y')
    expect(blanked.trimEnd().endsWith('; y')).toBe(true)
  })
})

describe('collectPrototypes', () => {
  it('declares setup and loop', () => {
    expect(collectPrototypes('void setup() {}\nvoid loop() {}')).toEqual([
      'void setup();',
      'void loop();',
    ])
  })

  it('declares helpers so loop may call a function defined below it', () => {
    const sketch = 'void setup() {}\nvoid loop() { blink(); }\nvoid blink() { delay(1); }'
    expect(collectPrototypes(sketch)).toContain('void blink();')
  })

  it('drops default arguments, which may only appear once', () => {
    expect(collectPrototypes('void step(int a, int b = 3) {}')).toEqual([
      'void step(int a, int b);',
    ])
  })

  it('keeps a trailing return type', () => {
    expect(collectPrototypes('auto twice(int x) -> int { return x * 2; }')).toEqual([
      'auto twice(int x) -> int;',
    ])
  })

  it('ignores control statements, lambdas, classes and initialisers', () => {
    const sketch = [
      'int values[] = {1, 2, 3};',
      'struct Point { int x; int y; };',
      'void setup() {',
      '  if (values[0] > 0) { digitalWrite(2, HIGH); }',
      '  auto f = [](int v) { return v + 1; };',
      '  for (int i = 0; i < 3; i++) { delay(1); }',
      '}',
      'void loop() {}',
    ].join('\n')
    expect(collectPrototypes(sketch)).toEqual(['void setup();', 'void loop();'])
  })

  it('ignores prototypes that only appear inside comments or strings', () => {
    expect(collectPrototypes('// void fake() {}\nconst char* s = "void other() {}";')).toEqual([])
  })

  it('does not swallow a preprocessor directive that precedes a definition', () => {
    const sketch = [
      '#include <EEPROM.h>',
      'void setup() { EEPROM.write(0, 42); }',
      'void loop() {}',
    ].join('\n')
    expect(collectPrototypes(sketch)).toEqual(['void setup();', 'void loop();'])
  })

  it('does not repeat a prototype for an overloaded overload pair', () => {
    const sketch = 'void f() {}\nvoid f(int a) {}\nvoid f() {}'
    expect(collectPrototypes(sketch)).toEqual(['void f();', 'void f(int a);'])
  })
})

describe('stripDefaultArguments', () => {
  it('strips a default in the middle of the list', () => {
    expect(stripDefaultArguments('int a, int b = 3, long c')).toBe('int a, int b, long c')
  })

  it('leaves comparisons and template arguments alone', () => {
    expect(stripDefaultArguments('int a, std::enable_if<(2 > 1)>::type* b')).toBe(
      'int a, std::enable_if<(2 > 1)>::type* b'
    )
  })

  it('handles a default that itself contains a comma', () => {
    expect(stripDefaultArguments('Point p = Point(1, 2)')).toBe('Point p')
  })
})

describe('buildTranslationUnit', () => {
  it('includes the core header, the prototypes and a line mapping', () => {
    const { source, fileName } = buildTranslationUnit('void setup() {}\nvoid loop() {}')
    expect(fileName).toBe('sketch.ino')
    expect(source).toContain('#include <Arduino.h>')
    expect(source).toContain('void setup();')
    expect(source).toContain('#line 1 "sketch.ino"')
    expect(source.endsWith('void setup() {}\nvoid loop() {}')).toBe(true)
  })

  it('lets the sketch start on line 1 for the compiler', () => {
    const { source } = buildTranslationUnit('int x;')
    const afterMarker = source.slice(source.indexOf('#line 1')).split('\n')
    expect(afterMarker[0]).toBe('#line 1 "sketch.ino"')
    expect(afterMarker[1]).toBe('int x;')
  })
})

describe('parseCompilerOutput', () => {
  it('reads errors with a column', () => {
    const output = "sketch.ino:5:3: error: 'x' was not declared in this scope"
    expect(parseCompilerOutput(output)).toEqual([
      { severity: 'error', line: 5, column: 3, message: "'x' was not declared in this scope" },
    ])
  })

  it('reads errors without a column and treats fatal errors as errors', () => {
    const output = [
      'sketch.ino:5: error: expected ; before } token',
      'sketch.ino:9:10: fatal error: Servo.h: No such file or directory',
    ].join('\n')
    expect(parseCompilerOutput(output)).toEqual([
      { severity: 'error', line: 5, column: null, message: 'expected ; before } token' },
      {
        severity: 'error',
        line: 9,
        column: 10,
        message: 'Servo.h: No such file or directory',
      },
    ])
  })

  it('keeps warnings and notes and ignores everything else', () => {
    const output = [
      "sketch.ino: In function 'void loop()':",
      "sketch.ino:4:7: warning: unused variable 'led' [-Wunused-variable]",
      "sketch.ino:4:7: note: 'led' was declared here",
      '   4 | int led = 3;',
      '     |     ^~~',
      'avr-g++: error: something went wrong on the command line',
    ].join('\n')
    expect(parseCompilerOutput(output)).toEqual([
      {
        severity: 'warning',
        line: 4,
        column: 7,
        message: "unused variable 'led' [-Wunused-variable]",
      },
      { severity: 'note', line: 4, column: 7, message: "'led' was declared here" },
    ])
  })
})

describe('parseSizeOutput', () => {
  it('reads the avr-size avr format', () => {
    const output = [
      'AVR Memory Usage',
      '----------------',
      'Device: atmega328p',
      '',
      'Program:    2316 bytes (7.1% Full)',
      '(.text + .data + .bootloader)',
      '',
      'Data:        196 bytes (9.6% Full)',
      '(.data + .bss + .noinit)',
    ].join('\n')
    expect(parseSizeOutput(output, 32256, 2048)).toEqual({
      flashBytes: 2316,
      flashCapacity: 32256,
      ramBytes: 196,
      ramCapacity: 2048,
    })
  })

  it('returns null when the tool did not report sizes', () => {
    expect(parseSizeOutput('avr-size: no such file', 32256, 2048)).toBeNull()
  })
})

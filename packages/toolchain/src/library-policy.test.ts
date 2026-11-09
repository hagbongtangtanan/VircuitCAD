import { expect, it } from 'vitest';

import { findUnknownIncludes, libraryMessage } from './library-policy';

const bundled = ['Servo', 'LiquidCrystal', 'Adafruit NeoPixel'];

it('accepts bundled libraries and core headers', () => {
  const source = ['#include <Servo.h>', '#include <avr/io.h>', '#include "math.h"'].join('\n');
  expect(findUnknownIncludes(source, bundled)).toEqual([]);
});

it('flags unknown includes', () => {
  const source = ['#include <Servo.h>', '#include <MissingLib.h>', '#include "mylib.h"'].join('\n');
  expect(findUnknownIncludes(source, bundled)).toEqual(['MissingLib.h', 'mylib.h']);
});

it('builds a clear not-bundled message', () => {
  const message = libraryMessage(['MissingLib.h'], bundled);
  expect(message).toContain('Not bundled: MissingLib.h');
  expect(message).toContain('Servo');
});

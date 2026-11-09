import { expect, it } from 'vitest';

import {
  ARDUINO_CONSTANTS,
  ARDUINO_FUNCTIONS,
  ARDUINO_KEYWORDS,
  arduinoCompletions,
} from './arduino-keywords';

it('includes the essentials', () => {
  expect(ARDUINO_KEYWORDS).toEqual(expect.arrayContaining(['setup', 'loop', 'int']));
  expect(ARDUINO_FUNCTIONS).toEqual(
    expect.arrayContaining(['pinMode', 'digitalWrite', 'delay', 'analogRead']),
  );
  expect(ARDUINO_CONSTANTS).toEqual(expect.arrayContaining(['HIGH', 'LOW', 'OUTPUT']));
});

it('produces unique completion labels', () => {
  const completions = arduinoCompletions();
  const labels = completions.map((completion) => completion.label);
  expect(new Set(labels).size).toBe(labels.length);
  expect(completions.find((c) => c.label === 'pinMode')?.kind).toBe('function');
  expect(completions.find((c) => c.label === 'HIGH')?.kind).toBe('constant');
});

import { expect, it } from 'vitest';

import { ARDUINO_BLOCK_TYPES } from './definitions';
import { TOOLBOX, TOOLBOX_CATEGORIES } from './toolbox';

const BUILTIN = new Set([
  'controls_if',
  'logic_compare',
  'logic_operation',
  'logic_negate',
  'logic_boolean',
  'controls_repeat_ext',
  'controls_for',
  'math_number',
  'math_arithmetic',
  'math_modulo',
  'variables_get',
  'variables_set',
  'math_change',
  'text',
]);

it('exposes the ten toolbox categories', () => {
  expect(TOOLBOX_CATEGORIES.map((category) => category.name)).toEqual([
    'Logic',
    'Loops',
    'Math',
    'Variables',
    'Text',
    'Arduino I/O',
    'Time',
    'Serial',
    'Servo',
    'LCD',
  ]);
  expect(TOOLBOX.kind).toBe('categoryToolbox');
});

it('lists blocks that are either built-in or defined by this package', () => {
  const defined = new Set(ARDUINO_BLOCK_TYPES);
  for (const category of TOOLBOX_CATEGORIES) {
    expect(category.contents.length).toBeGreaterThan(0);
    for (const entry of category.contents) {
      expect(BUILTIN.has(entry.type) || defined.has(entry.type), entry.type).toBe(true);
    }
  }
});

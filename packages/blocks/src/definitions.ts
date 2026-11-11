/** JSON definitions for the custom Arduino blocks. Pure data (Blockly-registered elsewhere). */

export const ARDUINO_BLOCK_DEFINITIONS: readonly Record<string, unknown>[] = [
  {
    type: 'io_pin_mode',
    message0: 'set pin %1 mode %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 13, min: 0, max: 19, precision: 1 },
      {
        type: 'field_dropdown',
        name: 'MODE',
        options: [
          ['OUTPUT', 'OUTPUT'],
          ['INPUT', 'INPUT'],
          ['INPUT_PULLUP', 'INPUT_PULLUP'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: 'io_digital_write',
    message0: 'digital write pin %1 %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 13, min: 0, max: 19, precision: 1 },
      {
        type: 'field_dropdown',
        name: 'STATE',
        options: [
          ['HIGH', 'HIGH'],
          ['LOW', 'LOW'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: 'io_analog_write',
    message0: 'analog write pin %1 value %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 9, min: 0, max: 19, precision: 1 },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: 'io_digital_read',
    message0: 'digital read pin %1',
    args0: [{ type: 'field_number', name: 'PIN', value: 2, min: 0, max: 19, precision: 1 }],
    output: 'Number',
    colour: 210,
  },
  {
    type: 'time_delay',
    message0: 'wait %1 ms',
    args0: [{ type: 'input_value', name: 'MS', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
  },
  {
    type: 'time_millis',
    message0: 'millis',
    output: 'Number',
    colour: 120,
  },
  {
    type: 'serial_print',
    message0: 'serial print %1',
    args0: [{ type: 'input_value', name: 'VALUE' }],
    previousStatement: null,
    nextStatement: null,
    colour: 270,
  },
  {
    type: 'servo_write',
    message0: 'servo pin %1 angle %2',
    args0: [
      { type: 'field_number', name: 'PIN', value: 9, min: 0, max: 19, precision: 1 },
      { type: 'input_value', name: 'ANGLE', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 0,
  },
  {
    type: 'lcd_set_cursor',
    message0: 'lcd cursor column %1 row %2',
    args0: [
      { type: 'field_number', name: 'COLUMN', value: 0, min: 0, max: 15, precision: 1 },
      { type: 'field_number', name: 'ROW', value: 0, min: 0, max: 1, precision: 1 },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 90,
  },
  {
    type: 'lcd_print',
    message0: 'lcd print %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: 'VircuitCAD' }],
    previousStatement: null,
    nextStatement: null,
    colour: 90,
  },
  {
    type: 'lcd_clear',
    message0: 'lcd clear',
    previousStatement: null,
    nextStatement: null,
    colour: 90,
  },
  {
    type: 'arduino_setup',
    message0: 'setup %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 30,
    tooltip: 'Runs once at startup',
  },
  {
    type: 'arduino_loop',
    message0: 'loop %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 30,
    tooltip: 'Runs forever after setup',
  },
] as const;

export const ARDUINO_BLOCK_TYPES: readonly string[] = ARDUINO_BLOCK_DEFINITIONS.map(
  (definition) => String(definition.type),
);

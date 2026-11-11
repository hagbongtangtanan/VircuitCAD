/**
 * Blockly toolbox for the Arduino block language. Pure data: the editor passes it to
 * `Blockly.inject({ toolbox })`. All block types are either built-in Blockly blocks or
 * registered by `registerArduinoBlocks()`.
 */

export type ToolboxBlock = { kind: 'block'; type: string };
export type ToolboxCategory = {
  kind: 'category';
  name: string;
  colour: string;
  contents: ToolboxBlock[];
};
export type Toolbox = { kind: 'categoryToolbox'; contents: ToolboxCategory[] };

const block = (type: string): ToolboxBlock => ({ kind: 'block', type });

export const TOOLBOX_CATEGORIES: ToolboxCategory[] = [
  {
    kind: 'category',
    name: 'Logic',
    colour: '#5b80a5',
    contents: [
      block('controls_if'),
      block('logic_compare'),
      block('logic_operation'),
      block('logic_negate'),
      block('logic_boolean'),
    ],
  },
  {
    kind: 'category',
    name: 'Loops',
    colour: '#5ba55b',
    contents: [block('controls_repeat_ext'), block('controls_for')],
  },
  {
    kind: 'category',
    name: 'Math',
    colour: '#5b67a5',
    contents: [block('math_number'), block('math_arithmetic'), block('math_modulo')],
  },
  {
    kind: 'category',
    name: 'Variables',
    colour: '#a55b80',
    contents: [block('variables_get'), block('variables_set'), block('math_change')],
  },
  {
    kind: 'category',
    name: 'Text',
    colour: '#5ba58c',
    contents: [block('text')],
  },
  {
    kind: 'category',
    name: 'Arduino I/O',
    colour: '#d2691e',
    contents: [
      block('io_pin_mode'),
      block('io_digital_write'),
      block('io_analog_write'),
      block('io_digital_read'),
    ],
  },
  {
    kind: 'category',
    name: 'Time',
    colour: '#a5745b',
    contents: [block('time_delay'), block('time_millis')],
  },
  {
    kind: 'category',
    name: 'Serial',
    colour: '#7f5ba5',
    contents: [block('serial_print')],
  },
  {
    kind: 'category',
    name: 'Servo',
    colour: '#a55b5b',
    contents: [block('servo_write')],
  },
  {
    kind: 'category',
    name: 'LCD',
    colour: '#4f7f4f',
    contents: [block('lcd_set_cursor'), block('lcd_print'), block('lcd_clear')],
  },
];

export const TOOLBOX: Toolbox = { kind: 'categoryToolbox', contents: TOOLBOX_CATEGORIES };

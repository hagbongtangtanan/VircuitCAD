export type CompletionKind = 'keyword' | 'function' | 'constant';
export type ArduinoCompletion = { label: string; kind: CompletionKind; detail?: string };

export const ARDUINO_KEYWORDS = [
  'setup',
  'loop',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'return',
  'const',
  'byte',
  'int',
  'long',
  'float',
  'double',
  'boolean',
  'char',
  'void',
  'unsigned',
  'volatile',
  'static',
  'true',
  'false',
];

export const ARDUINO_FUNCTIONS = [
  'pinMode',
  'digitalWrite',
  'digitalRead',
  'analogWrite',
  'analogRead',
  'delay',
  'delayMicroseconds',
  'millis',
  'micros',
  'map',
  'constrain',
  'min',
  'max',
  'abs',
  'tone',
  'noTone',
  'attachInterrupt',
  'detachInterrupt',
];

export const ARDUINO_CONSTANTS = [
  'HIGH',
  'LOW',
  'INPUT',
  'OUTPUT',
  'INPUT_PULLUP',
  'LED_BUILTIN',
  'A0',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
];

export function arduinoCompletions(): ArduinoCompletion[] {
  return [
    ...ARDUINO_KEYWORDS.map((label) => ({ label, kind: 'keyword' as const })),
    ...ARDUINO_FUNCTIONS.map((label) => ({ label, kind: 'function' as const })),
    ...ARDUINO_CONSTANTS.map((label) => ({ label, kind: 'constant' as const })),
  ];
}

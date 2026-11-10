import { expect, it } from 'vitest';

import { Hd44780 } from './hd44780';

function write(lcd: Hd44780, text: string): void {
  for (const char of text) lcd.data(char.charCodeAt(0));
}

it('renders text at the cursor and advances', () => {
  const lcd = new Hd44780();
  lcd.command(0x01); // clear
  write(lcd, 'Hello');
  expect(lcd.line(0)).toBe('Hello           ');
  expect(lcd.cursor()).toBe(5);
});

it('writes the second line after setting the DDRAM address', () => {
  const lcd = new Hd44780();
  lcd.command(0x80 | 0x40); // cursor to line 2
  write(lcd, 'World');
  expect(lcd.line(1)).toBe('World           ');
  expect(lcd.lines[0]).toBe('                ');
});

it('clears and homes the display', () => {
  const lcd = new Hd44780();
  write(lcd, 'abc');
  lcd.command(0x01);
  expect(lcd.line(0)).toBe('                ');
  expect(lcd.cursor()).toBe(0);
});

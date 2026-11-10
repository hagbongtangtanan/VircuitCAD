const DDRAM_SIZE = 80;
const LINE_STRIDE = 0x40;

/** Minimal HD44780 (16×2) controller model: DDRAM, cursor and text rendering. */
export class Hd44780 {
  private readonly ram: string[] = Array.from({ length: DDRAM_SIZE }, () => ' ');
  private address = 0;

  /** Instruction register (RS=0). Set-DDRAM-address (`0x80|addr`) and clear/home are honoured. */
  command(byte: number): void {
    const value = byte & 0xff;
    if ((value & 0x80) !== 0) {
      this.address = value & 0x7f;
    } else if (value === 0x01) {
      this.ram.fill(' ');
      this.address = 0;
    } else if (value === 0x02) {
      this.address = 0;
    }
  }

  /** Data register (RS=1): write a character at the cursor and advance it. */
  data(byte: number): void {
    if (this.address < DDRAM_SIZE) this.ram[this.address] = String.fromCharCode(byte & 0xff);
    this.address = (this.address + 1) % DDRAM_SIZE;
  }

  cursor(): number {
    return this.address;
  }

  line(row: 0 | 1): string {
    const start = row === 0 ? 0 : LINE_STRIDE;
    return this.ram.slice(start, start + 16).join('');
  }

  get lines(): [string, string] {
    return [this.line(0), this.line(1)];
  }
}

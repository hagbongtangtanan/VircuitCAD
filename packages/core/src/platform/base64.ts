const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP: Record<string, number> = {};
for (let index = 0; index < ALPHABET.length; index += 1) {
  LOOKUP[ALPHABET.charAt(index)] = index;
}

export function encodeBase64(data: Uint8Array): string {
  let output = '';
  for (let index = 0; index < data.length; index += 3) {
    const first = data[index] ?? 0;
    const second = data[index + 1];
    const third = data[index + 2];
    const triplet = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += ALPHABET.charAt((triplet >> 18) & 63);
    output += ALPHABET.charAt((triplet >> 12) & 63);
    output += second === undefined ? '=' : ALPHABET.charAt((triplet >> 6) & 63);
    output += third === undefined ? '=' : ALPHABET.charAt(triplet & 63);
  }
  return output;
}

export function decodeBase64(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  for (let index = 0; index < clean.length; index += 4) {
    const first = LOOKUP[clean.charAt(index)] ?? 0;
    const second = LOOKUP[clean.charAt(index + 1)] ?? 0;
    const thirdChar = clean.charAt(index + 2);
    const fourthChar = clean.charAt(index + 3);
    const third = thirdChar === '=' ? 0 : (LOOKUP[thirdChar] ?? 0);
    const fourth = fourthChar === '=' ? 0 : (LOOKUP[fourthChar] ?? 0);
    const triplet = (first << 18) | (second << 12) | (third << 6) | fourth;
    bytes.push((triplet >> 16) & 255);
    if (thirdChar !== '=') bytes.push((triplet >> 8) & 255);
    if (fourthChar !== '=') bytes.push(triplet & 255);
  }
  return Uint8Array.from(bytes);
}

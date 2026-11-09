const CORE_HEADERS = new Set([
  'arduino.h',
  'avr/io.h',
  'avr/interrupt.h',
  'avr/pgmspace.h',
  'math.h',
  'string.h',
  'stdint.h',
  'stdbool.h',
  'stdlib.h',
  'stdio.h',
  'wiring.c',
]);

function baseName(header: string): string {
  return (header.split('/').pop() ?? header).replace(/\.h$/, '').toLowerCase();
}

/** Returns the #include tokens that are neither a core header nor a bundled library. */
export function findUnknownIncludes(source: string, bundled: readonly string[]): string[] {
  const bundledNames = new Set(bundled.map((name) => name.toLowerCase()));
  const unknown = new Set<string>();

  for (const match of source.matchAll(/#\s*include\s*[<"]([^>"]+)[>"]/g)) {
    const header = match[1];
    if (!header) continue;
    if (CORE_HEADERS.has(header.toLowerCase())) continue;
    if (bundledNames.has(baseName(header))) continue;
    unknown.add(header);
  }
  return [...unknown];
}

export function libraryMessage(unknown: readonly string[], bundled: readonly string[]): string {
  return `Not bundled: ${unknown.join(', ')}. Available libraries: ${bundled.join(', ')}.`;
}

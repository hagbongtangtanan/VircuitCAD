import type { Diagnostic, DiagnosticSeverity, MemoryUsage } from './schemas'

/**
 * Pure helpers behind the compiler: nothing here touches the file system, so the
 * tricky parts (Arduino's automatic prototypes, GCC's diagnostic format) are unit
 * tested directly.
 */

const CONTROL_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'do',
  'else',
  'return',
  'catch',
  'case',
  'sizeof',
  'throw',
])

/** Declaration keywords that never introduce a forward-declarable function. */
const NON_FUNCTION_KEYWORDS = /\btemplate\b|\bclass\b|\bstruct\b|\benum\b|\bnamespace\b|\bunion\b/

/**
 * Blanks out comments, string and character literals while preserving every
 * offset and line break, so indices found here stay valid in the original text.
 */
export function blankLiterals(source: string): string {
  const out: string[] = Array.from(source, (character) => (character === '\n' ? '\n' : ' '))
  let index = 0

  while (index < source.length) {
    const character = source[index] ?? ''
    const next = source[index + 1] ?? ''

    if (character === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1
      continue
    }
    if (character === '/' && next === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') out[index] = '\n'
        index += 1
      }
      index += 2
      continue
    }
    if (character === '"' || character === "'") {
      const quote = character
      index += 1
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\') index += 1
        index += 1
      }
      index += 1
      continue
    }
    out[index] = character
    index += 1
  }

  return out.join('')
}

/** Skips backwards over whitespace, returning the index of the last real character. */
function skipSpaceBackwards(text: string, from: number): number {
  let index = from
  while (index >= 0 && /\s/.test(text[index] ?? '')) index -= 1
  return index
}

/** Index of the `(` matching the `)` at `closeIndex`, or -1. */
function matchOpenParen(text: string, closeIndex: number): number {
  let depth = 0
  for (let index = closeIndex; index >= 0; index -= 1) {
    const character = text[index]
    if (character === ')') depth += 1
    else if (character === '(') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

/** Start index of the identifier ending at `endIndex` (inclusive), or -1. */
function identifierStart(text: string, endIndex: number): number {
  let index = endIndex
  while (index >= 0 && /[A-Za-z0-9_~]/.test(text[index] ?? '')) index -= 1
  return index + 1
}

/**
 * Drops complete preprocessor lines from a declaration prefix. `#include` and
 * friends do not end with a semicolon, so the backwards scan happily walks past
 * them and would emit `#include <X.h> void setup();`.
 */
function dropPreprocessorLines(prefix: string): string {
  if (!prefix.includes('#')) return prefix
  const lines = prefix.split('\n')
  let start = 0
  for (let index = 0; index < lines.length - 1; index += 1) {
    if ((lines[index] ?? '').trimStart().startsWith('#')) start = index + 1
  }
  return lines.slice(start).join('\n')
}

/** True for a `=` that assigns, ignoring `==`, `<=`, `>=`, `!=` and compound ops. */
function isAssignmentEquals(parameters: string, index: number): boolean {
  const previous = parameters[index - 1] ?? ''
  const next = parameters[index + 1] ?? ''
  if (next === '=') return false
  return !'<>=!+-*/%&|^'.includes(previous)
}

/**
 * Removes `= default` clauses from a parameter list. Repeating a default value
 * in a forward declaration is an error in C++, so the prototype must drop them.
 */
export function stripDefaultArguments(parameters: string): string {
  const parts: string[] = []
  let depth = 0
  let current = ''

  for (const character of parameters) {
    if ('([{<'.includes(character)) depth += 1
    if (')]}>'.includes(character)) depth -= 1
    if (character === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += character
  }
  parts.push(current)

  return parts
    .map((part) => {
      for (let index = 0; index < part.length; index += 1) {
        if (part[index] === '=' && isAssignmentEquals(part, index))
          return part.slice(0, index).trim()
      }
      return part.trim()
    })
    .join(', ')
}

/**
 * Collects forward declarations for every function defined in the sketch. The
 * Arduino IDE does this so `loop()` may call a helper that is defined below it;
 * without it, perfectly ordinary sketches fail to compile.
 */
export function collectPrototypes(sketch: string): readonly string[] {
  const code = blankLiterals(sketch)
  const prototypes: string[] = []
  const seen = new Set<string>()
  let depth = 0

  for (let index = 0; index < code.length; index += 1) {
    const character = code[index]
    if (character === '}') {
      depth -= 1
      continue
    }
    if (character !== '{') continue

    if (depth !== 0) {
      depth += 1
      continue
    }
    depth += 1

    const beforeBrace = skipSpaceBackwards(code, index - 1)
    let closeParen = beforeBrace
    let trailingReturn = ''

    // `auto f(int) -> int { ... }` keeps the return type after the parameters.
    if (code[closeParen] !== ')') {
      const candidate = code.lastIndexOf(')', closeParen)
      if (candidate < 0) continue
      const between = code.slice(candidate + 1, index).trim()
      if (!between.startsWith('->')) continue
      trailingReturn = between
      closeParen = candidate
    }

    const openParen = matchOpenParen(code, closeParen)
    if (openParen < 0) continue

    const nameEnd = skipSpaceBackwards(code, openParen - 1)
    const nameStart = identifierStart(code, nameEnd)
    const name = code.slice(nameStart, nameEnd + 1)
    if (name === '' || CONTROL_KEYWORDS.has(name)) continue

    // Walk back to the start of the declaration, stopping at a statement or
    // block boundary. This captures the return type and any qualifiers.
    let cursor = nameStart - 1
    let nesting = 0
    while (cursor >= 0) {
      const candidate = code[cursor] ?? ''
      if (')]>'.includes(candidate)) nesting += 1
      if ('([<'.includes(candidate)) nesting -= 1
      if (nesting < 0) nesting = 0
      if (nesting === 0 && ';{}'.includes(candidate)) break
      cursor -= 1
    }

    const prefix = dropPreprocessorLines(code.slice(cursor + 1, nameStart)).trim()
    const parameters = code.slice(openParen + 1, closeParen)

    // Lambdas, assignments, templates and aggregate initialisers are not
    // free functions we can forward declare.
    if (prefix === '' && trailingReturn === '') continue
    if (prefix.includes('=') || prefix.includes(',') || prefix.includes('#')) continue
    if (NON_FUNCTION_KEYWORDS.test(prefix)) continue
    if (prefix.includes('::') || name.includes('::')) continue
    if (name === 'operator' || name.startsWith('operator')) continue

    const suffix = trailingReturn.startsWith('->') ? ` ${trailingReturn}` : ''
    const prototype = `${prefix} ${name}(${stripDefaultArguments(parameters)})${suffix};`
    const normalised = prototype.replace(/\s+/g, ' ').trim()
    if (seen.has(normalised)) continue
    seen.add(normalised)
    prototypes.push(normalised)
  }

  return prototypes
}

export interface TranslationUnit {
  readonly source: string
  /** File name reported inside compiler diagnostics. */
  readonly fileName: string
}

/**
 * Wraps an Arduino sketch in the translation unit the AVR compiler expects: the
 * core header, the generated prototypes, then the sketch itself, with a `#line`
 * directive so diagnostics point at the lines the user typed.
 */
export function buildTranslationUnit(sketch: string, fileName = 'sketch.ino'): TranslationUnit {
  const prototypes = collectPrototypes(sketch)
  const header = ['#include <Arduino.h>', ...prototypes, `#line 1 "${fileName}"`, '']
  return { source: `${header.join('\n')}${sketch}`, fileName }
}

const DIAGNOSTIC_PATTERN =
  /^(?<file>[^:\n]+):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<severity>fatal error|error|warning|note):\s*(?<message>.*)$/

function toSeverity(raw: string): DiagnosticSeverity {
  if (raw === 'warning') return 'warning'
  if (raw === 'note') return 'note'
  return 'error'
}

/**
 * Turns raw compiler stderr into diagnostics. Lines that do not look like
 * compiler messages (`In function 'x':`, source echoes) are skipped.
 */
export function parseCompilerOutput(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trimEnd()
    if (line === '') continue

    const match = DIAGNOSTIC_PATTERN.exec(line)
    if (match?.groups === undefined) continue

    const column = match.groups.column
    diagnostics.push({
      severity: toSeverity(match.groups.severity ?? 'error'),
      line: Number(match.groups.line),
      column: column === undefined ? null : Number(column),
      message: (match.groups.message ?? '').trim(),
    })
  }

  return diagnostics
}

const PROGRAM_PATTERN = /Program:\s+(\d+)\s+bytes/
const DATA_PATTERN = /Data:\s+(\d+)\s+bytes/

/**
 * Reads `avr-size --format=avr` output. Capacity comes from the board profile,
 * so this stays a pure function of the numbers the tool printed.
 */
export function parseSizeOutput(
  output: string,
  flashCapacity: number,
  ramCapacity: number
): MemoryUsage | null {
  const program = PROGRAM_PATTERN.exec(output)
  const data = DATA_PATTERN.exec(output)
  if (program?.[1] === undefined || data?.[1] === undefined) return null
  return {
    flashBytes: Number(program[1]),
    flashCapacity,
    ramBytes: Number(data[1]),
    ramCapacity,
  }
}

# BLOCKS — visual coding

Block-based coding that generates Arduino C++. Bundled **offline**: Blockly is a pinned
dependency (`blockly@13.4.0`, Apache-2.0) imported from `node_modules`, with the English
locale bundled. Nothing is fetched at runtime.

## Where things live

- `@vircuitcad/blocks` — pure IR, generator, toolbox data and the workspace→IR mapper.
  - `generateArduino(program)` — emits compilable C++ using only the core + bundled
    libraries. It auto-adds `#include <Servo.h>` / `#include <LiquidCrystal.h>`, starts
    `Serial`, and declares variables/servos as needed.
  - `TOOLBOX` — the category toolbox (pure data).
  - `workspaceToProgram(workspace)` — maps a Blockly workspace to the IR. It depends only on
    a structural `WorkspaceLike`/`BlockLike` interface, so it is unit-testable without Blockly.
- `@vircuitcad/blocks/blockly` — the only Blockly-aware entry point: `registerArduinoBlocks()`
  and the English locale. Import it (lazily) from the editor, never from pure code.

Keeping Blockly behind a subpath means the IR/generator/toolbox stay dependency-light and the
core `sim-*` packages keep their purity boundaries.

## Toolbox

Logic, Loops, Math, Variables, Text, Arduino I/O, Time, Serial, Servo and LCD. Logic/Loops/
Math/Variables/Text use built-in Blockly blocks; the rest are defined in `definitions.ts`
(`io_*`, `time_*`, `serial_print`, `servo_write`, `lcd_*`).

## Project mode and serialization

`.vcad` documents are schema **v2**. A project has a `mode` (`blocks` | `text`) and, for
blocks projects, a `blocks` field holding the serialized Blockly workspace (opaque to core).
Documents written before v2 migrate automatically to `mode: "text"` with no workspace; old
files keep opening (see `circuitMigrations` in `@vircuitcad/core`).

Switching a project **blocks → text** is allowed (with a warning); the generated C++ becomes
the editable sketch. **text → blocks is not offered** — a program cannot be reverse-mapped to
blocks.

## Blocks ↔ text parity

`fixtures/blocks/*.ino` are the handwritten references for five programs (blink, fade, servo,
lcd, serial). `generateArduino` output is byte-identical to them, and a `toolchain`-tagged test
compiles each generated sketch offline; identical source means identical hex and therefore
identical pin traces.

## Limitations

- Only the blocks above are available; there is no `while`, no arrays/strings beyond `text`,
  and `repeat` uses a fixed `i` loop variable.
- The generator targets the bundled Arduino core and the curated libraries only.
- Generated code is the source of truth once a project leaves blocks mode.

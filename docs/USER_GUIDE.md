# USER GUIDE

VircuitCAD is an offline desktop app for building, coding and simulating 2D circuits
(Arduino/AVR + analog + digital). Everything runs locally — no network, no accounts.

## Build a circuit

- Drag parts from the palette onto the breadboard; rotate and move them with the toolbar.
- Wire pins by dragging between holes/pins; the netlist updates as you go.
- Select a part to edit its parameters (resistance, voltage, colour, …) in the inspector.

## Code

- **Code** panel: write an Arduino sketch (Monaco editor, offline).
- **Blocks** panel: build the program from visual blocks; the generated C++ appears in the
  code view. Switching blocks → text is allowed (with a warning); text → blocks is not.
- Build & upload compiles with the bundled offline toolchain and runs on the emulated AVR.

## Run and observe

- **Run/Stop** control the simulation; speed can be adjusted in Settings.
- **Serial** monitor shows `Serial.print` output from the sketch.
- **Scope** plots probed signals; adjust time/div, volts/div and trigger.
- **Schematic** shows a read-only, auto-laid-out view of the netlist; export it as SVG.

## Examples

Open the example library to load ready-made circuits (Basics, Analog, Digital, Sensors,
Instruments, Arduino), searchable by name. Each loads and runs offline.

## Save and export

- Documents are `.vcad` files (schema v2; older files migrate automatically).
- Exports: canvas image, schematic SVG, `.ino` sketch, SPICE netlist, BOM CSV.

## Settings

Theme, grid visibility, simulation speed, autosave interval and units; settings persist
between sessions. Autosave writes a checksummed journal so work can be restored after a crash.

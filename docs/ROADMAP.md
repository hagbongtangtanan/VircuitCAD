# ROADMAP — VircuitCAD

Execution model: see `docs/RUNBOOK.md`. Each stage = branch `stage/sNN-slug` → PR → CI → squash-merge → tag `stage-sNN-done`.
Review gates (default `VC_PAUSE_AFTER="S04 S06 S11"`) stop automation so a human can test the Windows build.

| Stage | Outcome | Needs | Gate |
|---|---|---|---|
| S00 | Monorepo, strict TS, CI (ubuntu + windows), PlatformAdapter (electron + dev-web), blank Pixi canvas, installer artifact | — | |
| S01 | Zod circuit schema, part manifests, breadboard strips, netlist extractor, undo/redo store, `.vcad` + migrations | S00 | |
| S02 | Pan/zoom canvas, place/move/rotate/delete, wire tool, parts bin, inspector, save/load, E2E | S01 | |
| S03 | MNA solver: DC, Newton, transient, R/V/I/switch/C/L/diode/LED, diagnostics, ngspice golden tests | S01 | |
| S04 | Solver in a Worker, LED glow, multimeter, supply, examples — **LED lights up in the installer** | S02 S03 | ✋ human |
| S05 | Pinned arduino-cli + AVR core fetch, compile service, hash cache, hex fixtures | S00 | |
| S06 | avr8js worker, Uno part, GPIO/PWM/ADC/serial, Thevenin bridge, co-sim scheduler | S04 S05 | ✋ human |
| S07 | Monaco offline, compile+run, diagnostics, serial monitor, library policy | S06 | |
| S08 | BJT, MOSFET, op-amp, pot/LDR/NTC, relay, digital engine, 74xx, 555, 7-seg | S04 | |
| S09 | Scope, function generator, LCD1602, servo, motor, buzzer, sensors, NeoPixel, perf pass | S07 S08 | |
| S10 | Blockly, ≥ 25 examples, schematic view | S07 | |
| S11 | Autosave/recovery, settings, exports, soak tests, installer polish, docs, signing, beta | all | ✋ human |

S05 only depends on S00, so the order may be swapped with S02–S04 if desired; keep the numbering.

Non-goals (v1): 3D view, PCB design, cloud/accounts, collaboration, online libraries, Tinkercad import, ESP32/RP2040, touch UX.
Ideas go to `docs/BACKLOG.md` (one line each).

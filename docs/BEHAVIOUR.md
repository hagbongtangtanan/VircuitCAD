# BEHAVIOUR — code, compile and run lifecycle

Rules the UI and engine follow so build/run behaviour is predictable.

## States

`RunController` (editor) is the single source of truth: `idle → compiling → running`, plus `error`.
`compiling` starts when Build is pressed; a successful compile calls `onStart(hex)` and moves to
`running`; a failed compile moves to `error`.

## Editing while running

Editing the sketch calls `RunController.markEdited()`. When the state is `running` it returns `true`
and the UI prompts: **Restart** (rebuild + rerun) or keep editing. While compiling or idle there is
nothing to prompt.

## Recompile

Recompiling resets the emulated MCU (a fresh `McuCpu` with the new program, cycle counter cleared) but
leaves the circuit untouched — parts, wires and their state are preserved. Serial output continues in
the same transcript unless cleared.

## Races and staleness

Every Build increments a request id. Compile results are applied only if their id is current, so a
result that arrives after **Stop**, **Cancel** or a newer Build is dropped (no ghost LED toggling).

## Compile errors

Diagnostics (`@vircuitcad/toolchain`) become Monaco markers + the Problems list (`toMarkers`,
`markersByFile`, `ProblemsPanel`). A new compile clears the previous markers for the affected files.

## Serial

`SerialBuffer` keeps the last 10 000 lines (oldest dropped first). Sends append the chosen line ending
(`none`/`LF`/`CRLF`). Auto-scroll follows new lines unless the user turns it off.

## Offline

No CDN, no remote fonts, no telemetry. Monaco is bundled locally; the toolchain is fetched once by
`tools/fetch-toolchain.mjs` and runs as separate processes.

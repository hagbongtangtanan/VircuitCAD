# S03 — Analog solver engine

## Goal
A pure TypeScript MNA engine (`sim-analog`) with DC and transient analysis, robust convergence, friendly diagnostics, validated against ngspice. No UI.

## Read first
`docs/ARCHITECTURE.md` (Simulation notes), netlist shape from S01 Handoff, `docs/RISKS.md` rows on convergence/shorts.

## Tasks
- [x] **S03-T01** Linear algebra: dense matrix + LU with partial pivoting, singularity detection, reusable factorization buffers (typed arrays). → tests on known systems; bench at 50/100/200 nodes.
- [x] **S03-T02** MNA framework: node indexing from netlist, `Device` interface (`stamp`, `update`, `limit`, `breakpoints`), gmin on every node. → floating-node circuit solves without singularity.
- [x] **S03-T03** Linear devices: resistor, DC voltage source (with small internal R), current source, switch/pushbutton. → analytic checks (divider, Thevenin).
- [x] **S03-T04** DC operating point: Newton-Raphson loop, convergence criteria (abstol/reltol/vntol), iteration cap, gmin stepping then source stepping fallback. → hard circuits converge in tests.
- [x] **S03-T05** Nonlinear devices: diode, LED (colour-dependent Vf, series R, burnout flag at over-current), Zener; junction limiting (`pnjlim`). → I-V curve tests vs analytic.
- [ ] **S03-T06** Transient: capacitor, inductor (companion models), backward-Euler + trapezoidal, adaptive timestep with breakpoints. → RC/RL/RLC step-response tests within 1 %.
- [ ] **S03-T07** Diagnostics: typed `SimError` (`SHORT_CIRCUIT`, `NO_GROUND`, `FLOATING`, `NO_CONVERGENCE`, `SOURCE_LOOP`) carrying node/part refs. → each has a test circuit.
- [ ] **S03-T08** Golden harness: runner for native ngspice (skips if absent), 20+ circuit netlists, tolerance compare, **committed result JSON** so tests run without ngspice; script to regenerate. → tests tagged `golden`.
- [ ] **S03-T09** Benchmark (`bench/`) reporting steps/sec; `docs/MODELS.md` created with equations, tolerances and limits. → numbers recorded in Handoff.

## Pitfalls
- LED/diode exponentials overflow: clamp and limit voltage steps; start Newton from previous solution.
- Ideal source loops and inductor loops are singular: internal resistance, clear error.
- Trapezoidal ringing on switching: fall back to backward-Euler after discontinuities.
- Fixed ordering of nodes/devices for determinism; no `Math.random()` (seeded RNG only).
- Keep allocations out of the inner loop (typed arrays) — perf matters in S06.
- ngspice isn't a runtime dependency; never import it outside `tools/` and tests.

## Exit gate
- All unit + golden tests green; ≥ 20 golden circuits within tolerance (document tolerance).
- Benchmark: ≥ 20 000 transient steps/sec on a 20-node circuit in CI (note actual).

## Handoff to next stage
Record: engine public API (`createSimulation(netlist) → step/advance/probe`), device registration, error types, benchmark numbers.

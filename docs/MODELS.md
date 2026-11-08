# MODELS — analog engine equations, tolerances and limits

Educational-grade analog engine (`@vircuitcad/sim-analog`). Not a SPICE replacement: models are
simplified and documented here so results are predictable.

## Solver

- Modified Nodal Analysis with a dense LU solve (partial pivoting); nodes come from the circuit
  netlist (`buildNodeMap`, ground = 0).
- Newton–Raphson DC operating point with `reltol = 1e-3`, `vntol = 1e-6`, `abstol = 1e-12`,
  iteration cap 100; falls back to gmin stepping and then source stepping.
- gmin `1e-12` is stamped on every node each iteration (keeps floating/weakly-connected nodes
  solvable).
- Transient: backward Euler (default) or trapezoidal; adaptive step clamped to breakpoints.

## Devices

| Device | Equation | Notes |
|---|---|---|
| Resistor | `I = V / R` | `R <= 0` uses a 1 pS conductance guard |
| Voltage source | `Vp - Vn - i·Rs = Vs` | ideal when `Rs = 0`; default `Rs = 1e-6` |
| Current source | injects `I` from `from` to `to` | |
| Switch / button | closed: `1 mΩ`, open: gmin only | |
| Diode | Shockley `I = Is·(e^{Vd/(nVt)} − 1)` | `Is = 1e-12`, `Vt = 0.02585`, junction limiting (`pnjlim`) |
| LED | diode tuned to colour Vf at 20 mA + series `R = 20 Ω` | red 1.8 V, yellow 2.1 V, green 2.2 V, blue/white 3.0 V; **burnout flag** above 60 mA |
| Zener | forward diode + reverse knee at `Vz` | `IsBreakdown = 1e-3` |
| Capacitor | `i = C·dV/dt` | BE `G = C/dt`, trap `G = 2C/dt` |
| Inductor | `V = L·di/dt` | MNA branch, `R = L/dt` (BE) or `2L/dt` (trap) |

Exponential arguments are clamped to ±80·Vt; junction limiting also clamps the reverse-breakdown
step to `−Vz − 30·Vt`.

## Tolerances

- Golden DC circuits: `1e-6` relative.
- Golden RC step responses: 1 % (backward Euler, `dt = τ/100` over `5τ`).
- Unit tests: RC/RL within 1 %, diode operating point vs analytic within `1e-3` V.

## Limits

- Reactive elements use one-step integration (no LTE control); keep `dt` well below the smallest
  time constant.
- Trap ringing after hard switching is avoided by using backward Euler around discontinuities.
- No temperature, noise, junction capacitance, or magnetic coupling; parameter values are ideal.
- Homespun (non-Autodesk) part art only; results are intended for teaching, not sign-off.

## Instruments

- **Bench supply**: ideal source with a configurable voltage; the current limit is not yet enforced
  in the DC solve (documented limitation).
- **Multimeter**: `V` reads the net-voltage difference across its probes; `A` inserts a 0 V source
  (ammeter) and reads branch current; `Ω` is power-off only and currently reported as `null`.

## Worker and snapshots

Simulation runs in a Web Worker (see ADR 0003). The UI receives coalesced snapshots (≤ 60 Hz) with
node voltages (per net name), LED currents and multimeter readings, validated with zod.

## Performance baseline

- 50-part resistor ladder: ≈ 1.5 ms per DC solve (build + source stepping), measured locally.
- Editor with 100 parts: ≈ 30 fps under SwiftShader (no GPU, single worker); drops under parallel
  load. Board rendering stays constant draw calls.

## Golden harness

`packages/sim-analog/src/golden/` holds 20 circuits, a closed-form oracle, and a committed
`results.json` so tests run without ngspice. `tools/ngspice/` can shell out to native ngspice
(skipped when absent) and regenerate the results JSON.

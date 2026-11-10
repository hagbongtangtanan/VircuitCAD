# PARTS — adding a part

Parts are **data + a small model**, never new core code. A part needs all four of:

1. **Manifest** — in `packages/core/src/parts/catalog.ts` (validated by `PartManifestSchema`):
   `id`, `name`, `category`, `pins` (id, name, grid `position`, electrical `role`), `params`
   (id, label, unit, min/max, default), `simModel`, `svg`.
2. **Sim model** — a `case` in `buildSimulation` (`packages/sim-analog/src/bridge.ts`) mapping the
   `simModel` id to a device (e.g. `createResistor`, `createDiode`, `createMosfet`). Digital ICs will
   map to `sim-digital` in a later stage.
3. **Art** — a `case` in `packages/editor/src/render/part-textures.ts` (own vector art; never
   Autodesk/Tinkercad assets).
4. **Demo + test** — an example circuit under `examples/` and a unit test proving the model
   (analytic value, truth table, or a golden fixture).

## Scaffold

```
node tools/new-part.mjs <id> <sim-model>
```

Creates `parts/<id>/manifest.snippet.ts`, `parts/<id>/demo.vcad.json` and `parts/<id>/<id>.test.ts`
placeholders. Fill them in, paste the manifest into the catalog, add the bridge/art cases, then:

```
scripts/vc-check.sh full
```

## Rules

- Deterministic models only (no `Math.random`); fixed timesteps in tests.
- Keep pin grid positions in logical units and pin 1 marked for ICs (DIP straddles the centre gap).
- Two-pin passive parts map to `createResistor`/`createDiode`; three-terminal devices need
  `stampTransconductance` (see `createMosfet`).
- A part without a demo **and** a test is incomplete — CI should fail it (enforced from S10).

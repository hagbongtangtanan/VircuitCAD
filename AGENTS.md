# Project conventions

- Every newly added sample circuit — bundled `resources/samples/*.vcc` files and embedded `ALLOWED_STARTERS` starters — must use neat orthogonal wiring.
- All wire path segments must be axis-aligned; use `waypoints` instead of diagonal endpoint-to-endpoint runs.
- Keep existing connectivity and wire counts unchanged when re-routing.
- Mirror embedded starter edits in `recovered-src/out/renderer/assets/index-N0START1.js`, `recovered-src/out/renderer/assets/index-BU2QbNS1.js`, and `index-BU2QbNS1.js`, then repack with `node repack.js && cp app-modified.asar resources/app.asar`.
- Run `node tests/neat-wiring.mjs` after adding or changing a sample circuit.

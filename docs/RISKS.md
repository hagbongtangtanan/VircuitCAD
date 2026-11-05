# RISKS — known in advance (stage = where the mitigation is built)

| Risk | Mitigation | Stage |
|---|---|---|
| Offline Arduino compile (toolchain size, long/non-ASCII paths, antivirus) | Fetch pinned toolchain at build time into `resources/toolchain/` (never committed); compile in short temp path; hash cache; curated libs; test with network blocked and on a path with spaces; clean-VM QA | S05, S11 |
| Solver non-convergence (diodes, LEDs, BJTs, flyback) | Junction limiting, gmin + source stepping, adaptive step, gmin on every node | S03, S08 |
| Shorts / ideal source loops | Source internal R, singular-matrix detection → friendly error, LED burnout | S03, S04 |
| Co-sim performance | Workers, wall-clock pacing, 30–60 Hz UI, DC-on-event fast path, speed control, "running at 0.4×" warning | S04, S06, S09 |
| PWM / analog stiffness | Thevenin pin changes at edges; quasi-static fallback | S06 |
| SharedArrayBuffer headaches | Start with postMessage/transferables; SAB only if profiled (needs COOP/COEP) | S06, S09 |
| Breadboard UX complexity | rbush spatial index, pin-first hit-test, snap, property tests incl. half-board rail splits | S01, S02 |
| Part art licensing | Own SVGs (or verify MIT wokwi-elements at pinned version); no Autodesk assets/branding; THIRD_PARTY notice; GPL tools as separate processes (confirm with a lawyer before release) | S00, S05, S11 |
| WSL quirks | Repo in WSL FS, LF, POSIX paths, no case collisions, never `pnpm install` from both OSes, prefer dev-web over WSLg | S00 |
| Electron security | contextIsolation, sandbox, CSP, zod on IPC; preload bundled as CJS | S00 |
| Offline gaps | Bundle fonts + Monaco workers, no CDN; Playwright test fails on non-localhost request; run built app with network blocked | S00, S07, S11 |
| Save-file lock-in | `schemaVersion` + migration chain from day 1, old-file fixtures | S01, S10 |
| Scope creep | Non-goals list; `docs/BACKLOG.md` | all |
| AI failure modes | AGENTS.md rules; pinned deps; tests required; no deleting tests; ADR before refactors; 6-task sessions | all |
| Unsigned installer (SmartScreen) | Code-signing wiring; portable zip fallback | S11 |
| Accuracy expectations | State "educational-grade"; `docs/MODELS.md` with tolerances | S03, S11 |
| Context exhaustion | Fresh session per stage, ≤ 6 tasks per session, handoff in PROGRESS.md, auto-compaction as backup | all |
| Runaway automation | Permission deny-list, review gates, `main` protected by hook + PR flow, stage tags for rollback | all |

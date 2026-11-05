# Contributing

Read `AGENTS.md` first — it is the contract for both humans and AI sessions.

## Workflow

- Work is organised in **stages** (`docs/stages/Sxx-*.md`). One stage = one branch = one PR.
- Create/commit/push only via `scripts/vc-save.sh`; finish a stage with
  `scripts/vc-stage-finish.sh Sxx`.
- Use conventional commits; scope = package name (`core`, `sim-analog`, `editor`, …).
- Every behaviour change ships with tests; never delete or skip a test to go green.

## Local checks

- `scripts/vc-check.sh fast` — typecheck + lint + unit tests (`test:fast`).
- `scripts/vc-check.sh full` — adds the full test suite and build.
- `pnpm test:e2e` — offline/CSP guard.
- `pnpm check:licenses` — dependency license allowlist.

See `docs/RUNBOOK.md` for the human setup, review gates and recovery procedures.

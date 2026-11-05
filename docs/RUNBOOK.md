# RUNBOOK — for the human

## 1. One-time setup (WSL)
1. Create an empty GitHub repo `vircuitcad`. In WSL: `git clone … ~/dev/vircuitcad` (never under `/mnt/c`).
2. Copy this bundle into the repo root (keeps `AGENTS.md`, `opencode.json`, `.opencode/`, `.githooks/`, `scripts/`, `docs/`).
3. `gh auth login`, `opencode auth login` (pick your provider), then `bash scripts/vc-setup-wsl.sh` and fix any ✖.
4. Bootstrap commit (the only direct push to main):
   `git add -A && git commit -m "chore: add vircuitcad automation bundle" && VC_ALLOW_MAIN=1 git push -u origin main`
5. GitHub → Settings: allow squash merging, enable "Automatically delete head branches", Actions enabled. **After S00 merges**, add a branch-protection rule on `main` requiring status check `verify` (leave "require approvals" off for a solo repo).
6. Smoke-test permissions: `opencode run "run: git commit --allow-empty -m 'chore: x'"` must be **denied**; `scripts/vc-save.sh` must be allowed. (opencode applies bash rules by pattern; this bundle assumes the last matching rule wins — if the commit is NOT denied, move the deny rules below `"*": "allow"` or check the current permissions docs.)

## 2. Running
| Mode | Command | Use when |
|---|---|---|
| Hands-off, everything | `scripts/vc-run-stages.sh` | You trust the process; it stops at review gates |
| Hands-off, partial | `VC_STOP_AFTER=S03 scripts/vc-run-stages.sh` | Run up to a milestone |
| Supervised | `opencode` → `/stage S00` | Watching the agent; after the stage use `/new` |
| Single finish | `/stage-finish S03` | Retry only the PR/CI/merge step |

Env: `VC_MODEL=provider/model`, `VC_MAX_SESSIONS` (default 5), `VC_PAUSE_AFTER` (default `S04 S06 S11`), `VC_ALLOW_NO_CI=1`.
Run the driver inside `tmux` so it survives terminal closes. Logs: `.vc/logs/`.

## 3. How context stays small
1. **Fresh session per stage** (driver) — a hard reset, stronger than compaction.
2. **Handoff = deliberate compaction.** The agent overwrites `## Handoff` (≤ 15 lines) in `docs/PROGRESS.md`; checkboxes + git log carry the rest. The next session loads only AGENTS.md + PROGRESS.md + one stage file.
3. **≤ 6 tasks per session**, then handoff and exit; the driver starts a new session for the same stage.
4. opencode `compaction.auto/prune` stays on as a safety net inside a session.
5. In the TUI: `/handoff`, then `/compact` (keep going) or `/new` (clean slate). The agent cannot trigger `/compact` itself, which is why the driver and the handoff file exist.

## 4. Automated git (what happens on every save)
`vc-save.sh`: fast checks (typecheck, lint, test:fast) → tick task checkbox → `git add -A` → conventional commit (hooks: message format, no secrets/binaries/>5 MB) → push with 3 retries + rebase sync. Never on `main`, never force.
`vc-stage-finish.sh`: unchecked-task guard → full checks → mark done → PR → wait for CI → squash-merge → delete branch → tag `stage-sNN-done`.

## 5. Review gates (✋)
At S04, S06, S11 the PR stays open (exit 10). Download the installer artifact `vircuitcad-win` from the PR's Actions run, test on Windows, merge the PR yourself, rerun the driver.
Checklists live in each stage's "Exit gate" section.

## 6. Recovery
| Situation | Do |
|---|---|
| Session crashed / terminal closed | Rerun `scripts/vc-run-stages.sh` (resumes from branch + checkboxes + Handoff) |
| CI red at finish | Agent fixes via `/stage-finish`; or read `.vc/ci.txt` |
| Push failed | Work is committed locally; rerun `vc-save.sh` |
| Stage went wrong | `git checkout main && git reset --hard stage-sNN-done` of the previous stage (human only), delete the stage branch, rerun |
| Agent loops on one failure | After 3 tries it writes `Blocked:` in Handoff; read it, add guidance to the stage file, rerun |
| Edit stage tasks | Edit the stage file on `main` via a PR/chore commit before the stage starts |
| Dirty tree on `main` | Fix manually; scripts refuse to guess |
| `opencode run` hangs on a permission | Rules are allow/deny only (no `ask`); add the pattern to `opencode.json` |

## 7. Notes
- Opencode features this bundle relies on (verified against current docs): commands in `.opencode/commands/*.md` with `$ARGUMENTS`; `opencode run --command <name> "<args>"`; `permission.bash` pattern rules; `compaction` {auto, prune, reserved}. Run `opencode --version` and re-check the docs if behaviour differs after an upgrade.
- Never run `pnpm install` for the same folder from Windows *and* WSL.
- Windows builds are produced by GitHub Actions only.

---
description: Execute (or resume) a stage in a fresh context. Usage /stage [S03]
---
You are executing a VircuitCAD stage. Stage id argument: "$ARGUMENTS" (if empty, run `scripts/vc-status.sh next` and use that id; if it prints `none`, say all stages are done and stop).

Follow AGENTS.md strictly. Context is scarce.

1. Run `scripts/vc-stage-start.sh <ID>`. It syncs main, creates or resumes the stage branch and lists unchecked tasks. If it fails, fix the cause (never bypass) or stop and report.
2. Read ONLY `docs/PROGRESS.md` (the Handoff = state from the previous session/stage) and `docs/stages/<ID>-*.md`, plus the files its "Read first" section names. Run `git log --oneline -10` if resuming.
3. Execute the unchecked tasks in order. For each task: implement → write/adjust tests → run
   `scripts/vc-save.sh --task <ID>-Tnn "<type(scope): message>"`.
   The script runs checks, ticks the checkbox, commits and pushes. If it reports failures, fix them and rerun. Never skip checks.
4. **Session budget:** stop after 6 tasks in this session, even if the stage is unfinished. Then do step 6 (handoff) and end with `Session ended: stage <ID> unfinished, run /stage <ID> again`.
5. When every task is checked: do step 6, then run `scripts/vc-stage-finish.sh <ID>`.
   - Failure (checks/CI) → read the output, fix, `vc-save.sh`, rerun finish.
   - Exit code 10 → review gate: stop and tell the human the PR URL.
   - Success → the stage is merged; stop.
6. Handoff: overwrite the `## Handoff` section of `docs/PROGRESS.md` (≤ 15 lines: stage, last task done, next task, decisions, gotchas, blocked). Save with `scripts/vc-save.sh --no-check "docs(progress): handoff <ID>"`.

Final message: ≤ 5 lines (what was done, what is next). No long recaps.

---
description: Write the handoff now (use before /compact or /new)
---
Overwrite the `## Handoff` section in `docs/PROGRESS.md` (≤ 15 lines: active stage, last task done, next task, decisions, gotchas, blocked). Then run `scripts/vc-save.sh --no-check "docs(progress): handoff"`.
Reply with exactly: "Handoff saved. Run /compact (keep going) or /new then /stage (clean slate)." Nothing else.

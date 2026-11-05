---
description: Verify, open PR, wait for CI, merge. Usage /stage-finish S03
---
Run `scripts/vc-stage-finish.sh $ARGUMENTS`.
If it fails: read the (short) output, fix the cause, `scripts/vc-save.sh "fix(scope): …"`, rerun. Exit code 10 means a human review gate: stop and report the PR URL. Final message ≤ 3 lines.

#!/usr/bin/env bash
# Hands-off driver: one FRESH opencode session per stage (hard context reset),
# re-launched with a fresh session if a stage needs more than one.
# Env: VC_MODEL (provider/model), VC_STOP_AFTER (e.g. S03), VC_MAX_SESSIONS (default 5), VC_PAUSE_AFTER
source "$(dirname "$0")/lib.sh"
command -v opencode >/dev/null || die "opencode not found in PATH"
MAX="${VC_MAX_SESSIONS:-5}"
MODEL_ARGS=(); [ -n "${VC_MODEL:-}" ] && MODEL_ARGS=(-m "$VC_MODEL")

while true; do
  sid=$(scripts/vc-status.sh next)
  [ "$sid" != none ] || { info "🎉 all stages done"; exit 0; }
  [ "$(scripts/vc-status.sh get "$sid")" != blocked ] || die "$sid is marked blocked in docs/PROGRESS.md"

  attempt=0
  while [ "$(scripts/vc-status.sh get "$sid")" != done ]; do
    if [ -f ".vc/paused-$sid" ]; then info "⏸ $sid awaits human review/merge. Merge the PR, then rerun."; exit 0; fi
    attempt=$((attempt + 1))
    [ "$attempt" -le "$MAX" ] || die "$sid unfinished after $MAX sessions — read .vc/logs/ and the Handoff in docs/PROGRESS.md"

    log=".vc/logs/$sid-$attempt-$(date +%H%M%S).log"
    info "session $attempt/$MAX for $sid (fresh context) → $log"
    opencode run "${MODEL_ARGS[@]}" --command stage "$sid" 2>&1 | tee "$log" || true

    # safety net: persist anything the session left behind
    cur=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$cur" == stage/* ]] && [ -n "$(git status --porcelain)" ]; then
      scripts/vc-save.sh --wip "auto-save after session $attempt of $sid" || true
    fi
  done

  rm -f ".vc/paused-$sid"
  info "✔ $sid done"
  [ "$sid" != "${VC_STOP_AFTER:-}" ] || { info "stopping after $sid as requested"; exit 0; }
done

#!/usr/bin/env bash
# The ONLY way agents commit + push.
# Usage: scripts/vc-save.sh [--task S03-T02] [--no-check] [--wip] "type(scope): message"
source "$(dirname "$0")/lib.sh"

task=""; check=1; wip=0; msg=""
while [ $# -gt 0 ]; do
  case "$1" in
    --task) task="${2:?--task needs an id}"; shift 2;;
    --no-check) check=0; shift;;
    --wip) wip=1; check=0; shift;;
    *) msg="$1"; shift;;
  esac
done
[ -n "$msg" ] || die 'commit message required, e.g. "feat(core): add netlist extractor"'
if [ "$wip" = 1 ]; then case "$msg" in wip*) ;; *) msg="wip: $msg";; esac; fi

branch=$(git rev-parse --abbrev-ref HEAD)
case "$branch" in main|master|HEAD) die "refusing to commit on '$branch' — run scripts/vc-stage-start.sh <Sxx> first";; esac

if [ "$check" = 1 ]; then
  "$VC_ROOT/scripts/vc-check.sh" fast || die "checks failed — fix the problems above, then rerun this exact command"
fi

if [ -n "$task" ]; then
  sf=$(stage_file "${task%%-*}")
  grep -q "\*\*$task\*\*" "$sf" || die "task $task not found in $sf"
  sed -i -E "s/^- \[ \] (\*\*$task\*\*)/- [x] \1/" "$sf"
fi

git add -A
if git diff --cached --quiet; then
  info "nothing new to commit"
else
  git commit -q -m "$msg" || die "commit rejected by git hooks (see message above)"
  info "committed: $msg"
fi

for i in 1 2 3; do
  if git push -q -u origin HEAD 2>>.vc/push.err; then info "pushed $branch"; exit 0; fi
  info "push failed (attempt $i/3) — syncing with remote"
  if ! git pull --rebase -q origin "$branch" 2>>.vc/push.err; then
    if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
      git rebase --abort || true
      die "rebase conflict while syncing $branch — resolve manually; work is committed locally"
    fi
  fi
  sleep $((i * 3))
done
die "push failed after 3 attempts (see .vc/push.err). Work is committed locally; rerun to retry."

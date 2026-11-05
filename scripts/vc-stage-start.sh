#!/usr/bin/env bash
# Idempotent: creates the stage branch from fresh main, or resumes it.
source "$(dirname "$0")/lib.sh"
sid="${1:?usage: vc-stage-start.sh S03}"
sf=$(stage_file "$sid"); br=$(stage_branch "$sid")
[ "$(scripts/vc-status.sh get "$sid")" != done ] || die "$sid is already done"
git fetch origin --prune -q

if [ -n "$(git status --porcelain)" ]; then
  cur=$(git rev-parse --abbrev-ref HEAD)
  case "$cur" in
    stage/*) info "leftover changes on $cur — saving as wip"; scripts/vc-save.sh --wip "auto-save leftovers before resuming $sid";;
    *) die "dirty working tree on '$cur' — commit/stash manually first";;
  esac
fi

if git show-ref --verify --quiet "refs/heads/$br"; then
  git checkout -q "$br"; git pull --rebase -q origin "$br" 2>/dev/null || true
elif git show-ref --verify --quiet "refs/remotes/origin/$br"; then
  git checkout -q -b "$br" "origin/$br"
else
  git checkout -q main; git pull --ff-only -q origin main
  git checkout -q -b "$br"; git push -q -u origin "$br"
fi
info "on branch $br"
echo "Stage file: $sf"
echo "Unchecked tasks:"; { grep -n '^- \[ \]' "$sf" | cut -c1-110; } || true

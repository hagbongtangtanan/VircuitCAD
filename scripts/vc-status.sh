#!/usr/bin/env bash
# Usage: vc-status.sh next | get Sxx | show
# Authority: docs/PROGRESS.md on origin/main (+ existence of a stage branch => in-progress).
source "$(dirname "$0")/lib.sh"
git fetch origin --prune --quiet 2>/dev/null || true
progress() { git show origin/main:docs/PROGRESS.md 2>/dev/null || cat docs/PROGRESS.md; }
rows() { progress | awk -F'|' '/^\| *S[0-9][0-9] *\|/ {gsub(/ /,"",$2); gsub(/ /,"",$4); print $2" "$4}'; }
state() {
  local s
  s=$(rows | awk -v id="$1" '$1==id{print $2}')
  [ -n "$s" ] || die "unknown stage $1"
  if [ "$s" = done ] || [ "$s" = blocked ]; then echo "$s"; return; fi
  if git branch -a --list "*stage/$(lower "$1")-*" | grep -q .; then echo in-progress; else echo pending; fi
}
case "${1:-show}" in
  next) id=$(rows | awk '$2!="done"{print $1; exit}'); echo "${id:-none}";;
  get)  state "${2:?stage id}";;
  show) rows | while read -r id _; do printf '%s %s\n' "$id" "$(state "$id")"; done;;
  *) die "usage: vc-status.sh next|get Sxx|show";;
esac

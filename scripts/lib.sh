#!/usr/bin/env bash
# Shared helpers (sourced by the other vc-* scripts).
set -euo pipefail
VC_ROOT="$(git rev-parse --show-toplevel)"
cd "$VC_ROOT"
mkdir -p .vc/logs
die()  { echo "✖ $*" >&2; exit 1; }
info() { echo "▸ $*"; }
lower() { echo "$1" | tr 'A-Z' 'a-z'; }
stage_file() {
  local f
  f=$(ls docs/stages/"$1"-*.md 2>/dev/null | head -n1 || true)
  [ -n "$f" ] || die "no stage file for '$1' in docs/stages/"
  echo "$f"
}
stage_slug()   { basename "$(stage_file "$1")" .md | sed -E "s/^$1-//"; }
stage_branch() { echo "stage/$(lower "$1")-$(stage_slug "$1")"; }

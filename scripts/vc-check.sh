#!/usr/bin/env bash
# Quiet on success, short on failure. Usage: scripts/vc-check.sh [fast|full]
source "$(dirname "$0")/lib.sh"
level="${1:-fast}"
if [ ! -f package.json ]; then info "no package.json yet — checks skipped"; exit 0; fi
if [ ! -d node_modules ]; then info "installing dependencies…"; pnpm install --silent >/dev/null 2>&1 || die "pnpm install failed"; fi

rc=0
run() {
  local name="$1"; shift
  local out
  if out=$("$@" 2>&1); then info "$name ok"; else
    echo "✖ $name failed:"; echo "$out" | tail -n "${VC_TAIL:-60}"; rc=1
  fi
}
run typecheck pnpm -s -r --if-present typecheck
run lint      pnpm -s -r --if-present lint
if [ "$level" = full ]; then
  run test  pnpm -s -r --if-present test
  run build pnpm -s -r --if-present build
else
  run test  pnpm -s -r --if-present test:fast
fi
exit $rc

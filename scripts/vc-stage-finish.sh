#!/usr/bin/env bash
# Full checks -> mark done -> PR -> wait for CI -> squash merge -> tag.
# Exit 0 = merged. Exit 10 = review gate (PR left open). Other = fix and rerun.
source "$(dirname "$0")/lib.sh"
sid="${1:?usage: vc-stage-finish.sh S03}"
sf=$(stage_file "$sid"); br=$(stage_branch "$sid")
[ "$(git rev-parse --abbrev-ref HEAD)" = "$br" ] || die "not on $br — run scripts/vc-stage-start.sh $sid"
command -v gh >/dev/null || die "gh CLI not installed"

left=$(grep -c '^- \[ \]' "$sf" || true)
if [ "$left" != 0 ]; then echo "✖ $left unchecked task(s) in $sf:"; grep '^- \[ \]' "$sf" | cut -c1-120; exit 1; fi

scripts/vc-check.sh full || die "full checks failed"

if ! grep -qE "^\| *$sid *\|.*\| done \|" docs/PROGRESS.md; then
  sed -i -E "s/^(\| *$sid *\|[^|]*\|) *[a-z-]+ *\|/\1 done |/" docs/PROGRESS.md
  grep -qE "^\| *$sid *\|.*\| done \|" docs/PROGRESS.md || die "could not mark $sid done in docs/PROGRESS.md"
fi
scripts/vc-save.sh --no-check "docs(progress): mark $sid done"

title="Stage $sid: $(sed -n '1s/^# *//p' "$sf")"
if ! gh pr view "$br" >/dev/null 2>&1; then
  body=$(mktemp)
  { echo "Automated stage PR (\`$sf\`)."; echo; awk '/^## Exit gate/{f=1; print; next} f&&/^## /{exit} f' "$sf"; } > "$body"
  gh pr create --base main --head "$br" --title "$title" --body-file "$body" >/dev/null
  rm -f "$body"
fi
url=$(gh pr view "$br" --json url -q .url)
info "PR: $url"

info "waiting for CI…"
for _ in $(seq 1 30); do
  if gh pr checks "$br" 2>&1 | grep -qi "no checks reported"; then sleep 10; else break; fi
done
if gh pr checks "$br" 2>&1 | grep -qi "no checks reported"; then
  [ "${VC_ALLOW_NO_CI:-0}" = 1 ] || die "no CI checks appeared (set VC_ALLOW_NO_CI=1 to merge anyway)"
elif gh pr checks "$br" --watch --interval 15 >.vc/ci.txt 2>&1; then
  info "CI green"
else
  echo "✖ CI failed:"; tail -n 25 .vc/ci.txt
  rid=$(gh run list --branch "$br" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)
  [ -n "$rid" ] && { echo "--- failing log (tail) ---"; gh run view "$rid" --log-failed 2>/dev/null | tail -n 80; }
  exit 1
fi

if echo " ${VC_PAUSE_AFTER:-S04 S06 S11} " | grep -q " $sid "; then
  touch ".vc/paused-$sid"
  info "⏸ $sid is a HUMAN REVIEW GATE. Review and merge: $url"
  info "   then rerun scripts/vc-run-stages.sh (or /stage) to continue."
  exit 10
fi

gh pr merge "$br" --squash --delete-branch || die "merge failed (branch protection?). Merge manually: $url"
git checkout -q main; git pull --ff-only -q origin main
tag="stage-$(lower "$sid")-done"
git tag "$tag" 2>/dev/null && git push -q origin "$tag" || true
info "✔ $sid merged to main (tag $tag)"

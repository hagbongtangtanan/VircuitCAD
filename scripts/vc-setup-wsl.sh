#!/usr/bin/env bash
# One-time setup. Run from the repo root inside WSL.
set -euo pipefail
ok(){ echo "✔ $*"; }; warn(){ echo "⚠ $*"; }; bad(){ echo "✖ $*"; fail=1; }
fail=0
grep -qi microsoft /proc/version 2>/dev/null && ok "running in WSL" || warn "not WSL (fine for CI/Linux)"
case "$PWD" in /mnt/*) bad "repo is on the Windows drive ($PWD). Move it to ~/dev (WSL filesystem) — much faster, safer.";; *) ok "repo on Linux filesystem";; esac
git rev-parse --show-toplevel >/dev/null 2>&1 || bad "not a git repo"
git remote get-url origin >/dev/null 2>&1 && ok "origin: $(git remote get-url origin)" || bad "no 'origin' remote"
git config user.name  >/dev/null || bad "git user.name not set"
git config user.email >/dev/null || bad "git user.email not set"
command -v gh >/dev/null && { gh auth status >/dev/null 2>&1 && ok "gh authenticated" || bad "run: gh auth login"; } || bad "install GitHub CLI (gh)"
command -v node >/dev/null && ok "node $(node -v)" || bad "install Node LTS (fnm/nvm)"
command -v pnpm >/dev/null && ok "pnpm $(pnpm -v)" || warn "pnpm missing — run: corepack enable"
command -v opencode >/dev/null && ok "opencode $(opencode --version 2>/dev/null || true)" || bad "install opencode"
command -v ngspice >/dev/null && ok "ngspice present (golden tests)" || warn "optional: sudo apt install ngspice (golden-test regeneration)"
git config core.hooksPath .githooks
git config pull.rebase true
git config push.autoSetupRemote true
chmod +x scripts/*.sh .githooks/*
ok "hooks enabled (.githooks), scripts executable"
[ "$fail" = 0 ] && echo "Setup OK." || { echo "Fix the ✖ items and rerun."; exit 1; }

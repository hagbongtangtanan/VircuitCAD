# S11 — Polish, packaging, release

## Goal
A beta-quality, signed (or clearly unsigned) offline Windows release with crash recovery, exports, soak tests and documentation. Human review gate.

## Read first
`docs/RISKS.md` (all rows), previous Handoffs.

## Tasks
- [ ] **S11-T01** Crash recovery: journaled autosave + restore prompt; `.vcad` file association; recent files; single-instance lock; window-state persistence. → kill-the-process E2E restores the work.
- [ ] **S11-T02** Settings (theme, grid, sim speed, autosave interval, units), shortcut map + help overlay, i18n scaffold with all strings extracted (English only). → settings persist.
- [x] **S11-T03** Exports: PNG/SVG of the canvas, `.ino`, SPICE netlist, BOM CSV. → golden-file tests.
- [ ] **S11-T04** Accessibility/UX: keyboard-only toolbar, colour-blind-safe wire palette option, HiDPI check, empty-states and onboarding hints. → checklist in `docs/QA.md`.
- [ ] **S11-T05** Soak and perf: automated 1-hour run (heap growth ≤ agreed %), benchmark budgets with a >20 % regression failure in CI. → reports uploaded as artifacts.
- [ ] **S11-T06** Offline/security audit: licence report vs `THIRD_PARTY.md`, CSP review, dependency audit, run the built app with the network blocked. → recorded in `docs/SECURITY.md`.
- [ ] **S11-T07** Installer polish: NSIS per-user no-admin, clean uninstall, portable zip, version stamping, auto-update disabled; code-signing wired through optional secrets (unsigned fallback). → artifacts for both paths.
- [ ] **S11-T08** Release workflow on tags `v*` → draft GitHub Release with installer, portable zip, SHA256 sums; docs: user guide, `docs/MODELS.md` final tolerances, `KNOWN_ISSUES.md`, `LICENSES`. → dry-run on a pre-release tag.
- [ ] **S11-T09** Clean-VM QA checklist in `docs/QA.md` (blink, button-LED, pot LED, serial, scope, example sweep, uninstall) and tag proposal `v0.1.0-beta` in the PR description.

## Pitfalls
- SmartScreen warns on unsigned builds → document, ship the portable zip, plan a certificate.
- Autosave journal corruption on kill: write-then-rename, checksum.
- GPL notices for arduino-cli/avr-gcc: ship licence texts; keep process separation. Confirm legal position before public release (not legal advice).
- Soak tests flake on shared CI runners → compare against a baseline with tolerance.

## Exit gate
- All CI jobs green, release dry-run produced artifacts.
- **Human (S11 is a review gate):** run `docs/QA.md` on a clean Windows VM with networking disabled; sign off before tagging a release. Also obtain/configure the code-signing certificate if releasing publicly.

## Handoff to next stage
Final: record release notes, remaining backlog, known issues.

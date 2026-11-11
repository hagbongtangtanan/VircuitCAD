# QA — clean-VM release checklist

Run this on a **clean Windows 11 VM with networking disabled** before tagging a release.
S11 is a human review gate: complete the table, sign off, then tag.

## Preconditions

- Fresh Windows VM (no dev tools, no prior VircuitCAD install).
- Networking **disabled** after copying the installer/portable zip onto the VM.
- Installer and portable zip from the release dry-run (CI `package-windows` artifacts).

## Install

- [ ] NSIS installer runs **per-user, no admin prompt**.
- [ ] SmartScreen warning shows for the unsigned build; proceeding still installs.
- [ ] App launches; branding/version correct.
- [ ] Portable zip: extract and run without installing; settings live beside the app or in `%APPDATA%`.

## Smoke tests (offline)

- [ ] **Blink**: open the Blink example, Run, D13 LED blinks; stop works.
- [ ] **Button → LED**: pushbutton toggles the LED.
- [ ] **Pot → LED**: potentiometer changes LED brightness.
- [ ] **Serial**: serial monitor shows expected text; baud change works.
- [ ] **Scope**: probes render a waveform; trigger/time-div/volts-div change the trace.
- [ ] **Example sweep**: open every example from the library (search + categories); each loads and runs
      with no `SimError`; note any intentional errors.
- [ ] **Compile offline**: build a sketch with the network disabled (bundled toolchain only).
- [ ] **Exports**: PNG/SVG of the canvas, `.ino`, SPICE netlist and BOM CSV all open.

## Crash recovery / persistence

- [ ] Kill the app process mid-edit; relaunch offers to restore the autosaved work.
- [ ] Recent files and window state persist across restarts.
- [ ] Single-instance lock: launching again focuses the existing window.
- [ ] `.vcad` double-click opens the app (file association).

## Uninstall

- [ ] Uninstaller removes the app and Start-menu entry, leaves **no** user files behind.
- [ ] Reinstalling after uninstall starts clean.

## Sign-off

| Field | Value |
|---|---|
| Tester | |
| Date | |
| Build / commit | |
| Result | pass / fail |
| Notes / known issues | |

## Accessibility / UX

- [ ] Toolbar and main actions are reachable and operable **keyboard-only** (tab order, Enter/Space,
      visible focus rings; no focus traps).
- [ ] Colour-blind-safe wire palette can be enabled and keeps wires distinguishable.
- [ ] HiDPI: UI and canvas are crisp at 100%, 150% and 200% scaling; no blurry bitmaps.
- [ ] Empty states are helpful: empty canvas, no examples match a search, nothing in the serial
      monitor, no probe selected all show a guiding message.
- [ ] Onboarding hints appear on first run and can be dismissed.

## Tag proposal

Propose **`v0.1.0-beta`** once every box above is checked. Record the signed-off commit in the PR
description.

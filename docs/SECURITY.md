# SECURITY — offline and security audit

Recorded for the S11 release. Re-run the checks below before every public release.

## Posture

VircuitCAD is an **offline-first** desktop app. Nothing is fetched at runtime: no CDN, no remote
fonts, no telemetry. The only network access is compile-time dependency installation and the
one-time toolchain fetch (`resources/toolchain/`).

## Electron hardening

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for the renderer.
- Preload is bundled as CJS and exposes only the RPC bridge.
- Every IPC payload is validated with **zod** (`handleRpc` → adapter).
- Strict CSP, applied both via `<meta http-equiv>` and the `onHeadersReceived` response header:

  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self';
  img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`

  `style-src 'unsafe-inline'` is required by the renderer's styling; there is no `unsafe-eval`.
- `object-src 'none'` and `frame-ancestors 'none'` block plugin/embedding vectors.

## Offline verification

- Playwright fails the suite on any non-localhost request (`e2e/`), guarding against accidental
  CDN usage.
- Compile the bundled sketches with the network disabled (toolchain CI job uses `unshare -n`).
- Clean-VM QA (`docs/QA.md`) runs the **built** app with networking disabled.

## Licenses

- `pnpm check:licenses` enforces a permissive allowlist (MIT, Apache-2.0, BSD, ISC, MPL-2.0,
  …). Current result: **pass** (14 license expressions).
- Bundled runtime components and the GPL toolchain (separate processes) are documented in
  `THIRD_PARTY.md`.

## Dependency audit

- `pnpm audit --prod` — **no known vulnerabilities** after overriding the transitive
  `monaco-editor → dompurify` to `3.4.17` (see `pnpm.overrides` in the root `package.json`).
  Without the override the range pulled `dompurify@3.4.15`, which carried several advisories
  (1 critical, 1 high, 3 low; all HTML-sanitizer issues in code paths VircuitCAD does not expose).

## Risks / follow-ups

- **Unsigned installer**: SmartScreen warns. Ship the portable zip and document the warning
  (`docs/QA.md`); plan a code-signing certificate before a public release.
- Re-check the `dompurify` override when `monaco-editor` bumps its dependency; drop it once a
  fixed version is used upstream.

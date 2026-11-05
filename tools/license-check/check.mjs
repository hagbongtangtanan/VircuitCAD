import { execFileSync } from 'node:child_process';

const ALLOWED = new Set([
  'MIT',
  'Apache-2.0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'Python-2.0',
  'WTFPL',
  'CC0-1.0',
  'Unlicense',
  'MPL-2.0',
]);

function isAllowed(expression) {
  const cleaned = expression.replace(/[()]/g, '').trim();
  if (cleaned.includes(' OR ')) return cleaned.split(' OR ').some((part) => isAllowed(part.trim()));
  if (cleaned.includes(' AND ')) return cleaned.split(' AND ').every((part) => isAllowed(part.trim()));
  return ALLOWED.has(cleaned);
}

const raw = execFileSync('pnpm', ['licenses', 'list', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const byLicense = JSON.parse(raw);

const violations = [];
for (const [license, packages] of Object.entries(byLicense)) {
  if (isAllowed(license)) continue;
  for (const pkg of packages) {
    violations.push(`${pkg.name}@${pkg.versions.join(',')} — ${license}`);
  }
}

if (violations.length > 0) {
  console.error('✖ disallowed licenses:\n' + violations.join('\n'));
  process.exit(1);
}
console.log(`✔ license check passed (${Object.keys(byLicense).length} license expressions)`);

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { goldenResults } from '../../packages/sim-analog/src/golden/oracle.ts';
import { hasNgspice } from './runner.ts';

const output = fileURLToPath(
  new URL('../../packages/sim-analog/src/golden/results.json', import.meta.url),
);

const results = goldenResults();
writeFileSync(output, `${JSON.stringify(results, null, 2)}\n`);

if (hasNgspice()) {
  console.log('ngspice detected: results could be refreshed against it (DC values are closed-form here)');
} else {
  console.log('ngspice not found: wrote closed-form reference results');
}
console.log(`wrote ${output} (${Object.keys(results).length} circuits)`);

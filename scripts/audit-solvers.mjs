import fs from "node:fs";

const root = process.cwd();
const circuitPath = `${root}/src/shared/circuit.ts`;
const solverPath = `${root}/src/renderer/sim/solver.ts`;

const circuit = fs.readFileSync(circuitPath, "utf8");
const solver = fs.readFileSync(solverPath, "utf8");

const enumMatch = circuit.match(/partTypeSchema\s*=\s*z\.enum\(\[[\s\S]*?\]\)/);
if (!enumMatch) {
  throw new Error("Could not find partTypeSchema");
}

const registered = [...enumMatch[0].matchAll(/'([^']+)'/g)].map((match) => match[1]);
function mainSolverCases(code) {
  const switches = [...code.matchAll(/switch \(part\.type\) \{/g)];
const equalityMatches = [...solver.matchAll(/part\.type\s*===?\s*'([^']+)'/g)].map((match) => match[1]);
  let best = [];
  for (const sw of switches) {
    const switchStart = sw.index + sw[0].lastIndexOf('{');
    let depth = 0;
    let i = switchStart;
    for (; i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const block = code.slice(switchStart, i + 1);
    const cases = [...block.matchAll(/\bcase\s+'([^']+)'\s*:/g)].map((match) => match[1]);
    if (cases.length > best.length) best = cases;
  }
  if (best.length === 0) throw new Error('Main solver switch not found');
  return best;
}
const equalityMatches = [...solver.matchAll(/part\.type\s*===?\s*'([^']+)'\s*/g)].map((match) => match[1]);
const caseMatches = mainSolverCases(solver);
const gateTopologyMatch = fs.readFileSync(`${root}/src/renderer/parts/definitions.ts`, 'utf8').match(/export const GATE_TOPOLOGY[^=]*=\s*\{([\s\S]*?)\n\}/);
const topologyKeys = [...(gateTopologyMatch?.[1].matchAll(/'([^']+)'/g) ?? [])].map((match) => match[1]);
const handled = new Set([...caseMatches, ...topologyKeys, ...equalityMatches]);

function categorize(type) {
  if (/^(arduino|raspberry|microbit|attiny)/.test(type)) return "Controllers / Boards";
  if (/^(resistor|capacitor|inductor|diode|zener|electrolytic)/.test(type)) return "Passives & Semiconductors";
  if (/^(led|buzzer|light-bulb|neopixel|lcd|seven-segment|vibration|gear|dc-motor|servo|encoder)/.test(type)) return "Outputs & Actuators";
  if (/^(push-button|slide-switch|dip-switch|potentiometer|ldr|photo|thermistor|flex|force|tilt|soil|gas|tmp36|ultrasonic|pir|ir|keypad|encoder-motor)/.test(type)) return "Inputs & Sensors";
  if (/^(74hc|cd4511)/.test(type)) return "Logic ICs";
  if (/^(ic-555|ic-556|opamp|comparator|optocoupler|transistor|tip|mosfet|relay|l293d|lm7805|ld1117)/.test(type)) return "Discrete ICs & Drivers";
  if (/^(multimeter|oscilloscope|function-generator|power-supply|battery|coin-cell|solar-cell|potato-battery)/.test(type)) return "Instruments & Power";
  if (/^(breadboard|header|usb)/.test(type)) return "Interconnects / Mechanical";
  return "Miscellaneous";
}

const registrySet = new Set(registered);
const missing = registered.filter((type) => !handled.has(type));
const helperAliases = new Set(['and', 'nand', 'nor', 'not', 'or', 'xor']);
const orphaned = [...handled].filter((type) => !registrySet.has(type) && !helperAliases.has(type));

const byCategory = new Map();
for (const type of missing) {
  const category = categorize(type);
  if (!byCategory.has(category)) byCategory.set(category, []);
  byCategory.get(category).push(type);
}

console.log("===== VircuitCAD Solver Coverage Audit =====");
console.log(`Registered component types: ${registered.length}`);
console.log(`Explicit solver case types: ${handled.size}`);
console.log(`Missing handled types: ${missing.length}`);
console.log(`Orphaned solver cases: ${orphaned.length}`);
console.log("");

console.log("Missing by category:");
for (const [category, types] of [...byCategory.entries()].sort()) {
  if (types.length === 0) continue;
  console.log(`\n- ${category} (${types.length}):`);
  for (const type of types.sort()) console.log(`  • ${type}`);
}

if (orphaned.length > 0) {
  console.log("\nOrphaned solver cases:");
  for (const type of orphaned.sort()) console.log(`  • ${type}`);
}

console.log("\n===== End Audit =====");

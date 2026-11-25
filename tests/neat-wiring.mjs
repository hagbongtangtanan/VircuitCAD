import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = process.env.OUT_DIR || path.join(root, "artifacts", "neat-wiring");
const bundlePath = path.join(
  root,
  "recovered-src",
  "out",
  "renderer",
  "assets",
  "index-N0START1.js",
);
const samplesDir = path.join(root, "resources", "samples");
fs.mkdirSync(outDir, { recursive: true });

const bundle = fs.readFileSync(bundlePath, "utf8");
const allowedBlock = bundle.match(/var ALLOWED_STARTERS = \[([\s\S]*?)\];/);
if (allowedBlock === null) throw new Error("ALLOWED_STARTERS not found");
const starterIds = [...allowedBlock[1].matchAll(/"([^"]+)"/g)].map(
  (match) => match[1],
);
const projects = [];
for (const file of fs.readdirSync(samplesDir).filter((name) => name.endsWith(".vcc")).sort()) {
  const project = JSON.parse(fs.readFileSync(path.join(samplesDir, file), "utf8"));
  projects.push({ name: path.basename(file, ".vcc"), circuit: project.circuit });
}
for (const id of starterIds) {
  const variable = `${id.replace(/-/g, "_")}_default`;
  const pattern = new RegExp(`var ${variable} =\\s*'((?:[^'\\\\]|\\\\.)*)';`);
  const match = pattern.exec(bundle);
  if (match === null) throw new Error(`${variable} not found in renderer bundle`);
  const project = JSON.parse(vm.runInNewContext(`'${match[1]}'`));
  projects.push({ name: id, circuit: project.circuit });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let targets;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    if (targets.some((item) => item.type === "page" && (item.url.startsWith("file:") || item.url.startsWith("http:")))) break;
  } catch {}
  await wait(500);
}
const target = targets?.find((item) => item.type === "page" && (item.url.startsWith("file:") || item.url.startsWith("http:")));
if (target === void 0) throw new Error(`No renderer page on debug port ${port}`);

const consoleErrors = [];
const ws = new WebSocket(target.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown")
    consoleErrors.push(message.params.exceptionDetails?.text ?? "exception");
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
    consoleErrors.push(
      message.params.args.map((arg) => arg.value ?? arg.description).join(" "),
    );
  if (message.id !== void 0 && pending.has(message.id)) {
    pending.get(message.id)(message.result);
    pending.delete(message.id);
  }
};
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++requestId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails !== void 0)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};

const checkCircuit = async (circuit) => {
  const expression = `(() => {
    const circuit = ${JSON.stringify(circuit)};
    window.__LCD_STORE__.getState().replaceDocument(circuit);
    const endpoints = window.__SEVEN_SEGMENT_WIRE_ENDPOINTS__();
    const wires = window.__LCD_STORE__.getState().document.wires;
    const diagonals = [];
    for (const wire of wires) {
      const mapping = endpoints.find((item) => item.id === wire.id);
      const points = [mapping?.from?.world, ...(wire.waypoints ?? []), mapping?.to?.world];
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        if (a == null || b == null) {
          diagonals.push({ wire: wire.id, issue: "missing endpoint" });
          break;
        }
        if (Math.abs(a.x - b.x) > 1e-6 && Math.abs(a.y - b.y) > 1e-6) {
          diagonals.push({ wire: wire.id, from: a, to: b });
        }
      }
    }
    return { wireCount: wires.length, diagonals };
  })()`;
  return evaluate(expression);
};

const results = [];
for (const project of projects) {
  const result = await checkCircuit(project.circuit);
  results.push({
    name: project.name,
    wireCount: result.wireCount,
    diagonalSegments: result.diagonals.length,
    diagonals: result.diagonals,
  });
}
const failures = results.filter(
  (result) => result.diagonalSegments > 0 || result.wireCount === 0,
);
const report = {
  checked: results.length,
  failures,
  results,
  consoleErrors,
  pass: failures.length === 0 && consoleErrors.length === 0,
  logFile: path.join(outDir, "acceptance-log.json"),
};
fs.writeFileSync(report.logFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
if (report.pass === false) process.exitCode = 1;

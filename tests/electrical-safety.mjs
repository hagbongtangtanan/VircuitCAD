import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || path.join(here, "..", "artifacts", "electrical-safety");
fs.mkdirSync(outDir, { recursive: true });

const samples = [
  "blink-led.vcc",
  "potentiometer.vcc",
  "seven-segment-counter.vcc",
  "traffic-light.vcc",
];
const starters = [
  "uno-blink",
  "uno-button-led",
  "uno-traffic-light",
  "uno-servo",
  "uno-millis-timer",
  "uno-ultrasonic",
  "uno-ldr",
  "uno-lcd-hello",
];
const cards = [
  ...samples.map((id) => ({ id, selector: `sample-card-${id}`, kind: "sample" })),
  ...starters.map((id) => ({ id, selector: `starter-card-${id}`, kind: "starter" })),
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page" && (item.url.startsWith("file:") || item.url.startsWith("http:")));
if (target === void 0) throw new Error(`No renderer page on debug port ${port}`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();
const consoleErrors = [];
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

await send("Runtime.enable");
await send("Page.enable");
await evaluate(
  "(()=>{const b=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close');b?.click();return true;})()",
);
await wait(300);

const results = [];
for (const card of cards) {
  const started = await evaluate(`(async()=>{
    window.__LCD_SIM_STORE__.getState().stop();
    document.querySelector('[data-testid="samples-toggle"]').click();
    await new Promise(resolve=>setTimeout(resolve,220));
    const card=document.querySelector('[data-testid="${card.selector}"]');
    if(card===null) return {loaded:false,status:null,error:null};
    card.click();
    await new Promise(resolve=>setTimeout(resolve,420));
    window.__LCD_DAMAGE_ENGINE__.reset();
    await window.__LCD_SIM_STORE__.getState().start();
    return {
      loaded:true,
      status:window.__LCD_SIM_STORE__.getState().status,
      error:window.__LCD_SIM_STORE__.getState().error,
      title:document.querySelector('[data-testid="project-title"]')?.value,
    };
  })()`);
  await wait(2000);
  const snapshot = await evaluate(`(()=>{
    const damage=window.__LCD_DAMAGE_ENGINE__.snapshot();
    const sim=window.__LCD_SIM_STORE__.getState();
    return {
      status:sim.status,
      simError:sim.error,
      events:damage.events.map((event)=>({severity:event.severity,message:event.message})),
      failedParts:damage.failedParts,
      failedSegments:damage.failedSegments,
      deadPins:damage.deadPins,
      failedWires:damage.failedWires,
      warnings:damage.states.filter((state)=>state.status==='warning').map((state)=>state.reason||state.key),
    };
  })()`);
  await evaluate("window.__LCD_SIM_STORE__.getState().stop(); true");
  results.push({
    ...card,
    started,
    ...snapshot,
    pass:
      started.loaded &&
      started.status === "running" &&
      started.error === null &&
      snapshot.status === "running" &&
      snapshot.simError === null &&
      snapshot.events.length === 0 &&
      snapshot.failedParts.length === 0 &&
      snapshot.failedSegments.length === 0 &&
      snapshot.deadPins.length === 0 &&
      snapshot.failedWires.length === 0 &&
      snapshot.warnings.length === 0,
  });
}

const report = {
  checked: results.length,
  results,
  consoleErrors,
  pass: results.every((result) => result.pass) && consoleErrors.length === 0,
  logFile: path.join(outDir, "acceptance-log.json"),
};
fs.writeFileSync(report.logFile, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      pass: report.pass,
      checked: report.checked,
      failures: results.filter((result) => !result.pass),
      consoleErrors,
      logFile: report.logFile,
    },
    null,
    2,
  ),
);
ws.close();
if (report.pass === false) process.exitCode = 1;

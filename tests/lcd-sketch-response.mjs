import fs from "node:fs";

const port = process.env.CDP_PORT || "9334";
const outDir = "/tmp/opencode/lcd-sketch-response";
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
const target = targets.find((item) => item.type === "page" && (item.url.startsWith("file:") || item.url.startsWith("http:")));
if (target === void 0) throw new Error(`No renderer page on debug port ${port}`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown")
    consoleErrors.push(message.params.exceptionDetails?.text ?? "exception");
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
    consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  if (message.id !== void 0 && pending.has(message.id)) {
    pending.get(message.id)(message.result);
    pending.delete(message.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const requestId = ++id;
    pending.set(requestId, resolve);
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails !== void 0) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
await new Promise((resolve) => (ws.onopen = resolve));
await send("Runtime.enable");
await send("Page.enable");
await evaluate(
  "(()=>{const b=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close');b?.click();return true;})()",
);
await wait(300);
await evaluate("document.querySelector('[data-testid=\"samples-toggle\"]').click(); true");
await wait(350);
await evaluate("document.querySelector('[data-testid=\"starter-card-uno-lcd-hello\"]').click(); true");
await wait(500);
const loaded = await evaluate(`({
  title:document.querySelector('[data-testid="project-title"]')?.value,
  partTypes:window.__LCD_STORE__.getState().document.parts.map((part)=>part.type),
  wireCount:window.__LCD_STORE__.getState().document.wires.length,
})`);
const beforeSim = await evaluate(`(()=>{
  const lcd=window.__LCD_STORE__.getState().document.parts.find((part)=>part.type==='lcd-16x2-i2c');
  return {
    simStatus:window.__LCD_SIM_STORE__.getState().status,
    display:lcd ? window.__LCD_SIM_STORE__.getState().lcdDisplays[lcd.id] ?? null : null,
    metrics:lcd ? window.__LCD_RENDER_METRICS__?.[lcd.id] ?? null : null,
  };
})()`);
await evaluate("document.querySelector('[data-testid=\"sim-button\"]').click(); true");

let state = null;
const observedBacklight = new Set();
const observedLitColors = new Set();
for (let attempt = 0; attempt < 80; attempt += 1) {
  await wait(500);
  state = await evaluate(`(()=>{
    const sim=window.__LCD_SIM_STORE__.getState();
    const documentState=window.__LCD_STORE__.getState().document;
    const lcd=documentState.parts.find((part)=>part.type==='lcd-16x2-i2c');
    return {
      status:sim.status,
      error:sim.error,
      simStatusText:document.querySelector('[data-testid="sim-status"]')?.textContent,
      display:lcd ? sim.lcdDisplays[lcd.id] ?? null : null,
      metrics:lcd ? window.__LCD_RENDER_METRICS__?.[lcd.id] ?? null : null,
      engine:window.__LCD_SIM_ENGINE__ ? {
        twiState:JSON.parse(JSON.stringify(window.__LCD_SIM_ENGINE__.twiState)),
        lcdState:lcd ? JSON.parse(JSON.stringify(window.__LCD_SIM_ENGINE__.lcdDisplays.get(lcd.id) ?? null)) : null,
      } : null,
    };
  })()`);
  if (typeof state.display?.backlight === "boolean")
    observedBacklight.add(state.display.backlight);
  if (typeof state.metrics?.litColor === "string")
    observedLitColors.add(state.metrics.litColor);
  if (state.status === "error") break;
  if (
    state.display?.lines?.join("").includes("Hello") &&
    observedBacklight.has(true) &&
    observedBacklight.has(false) &&
    observedLitColors.size > 1
  )
    break;
}
const shot = await send("Page.captureScreenshot", { format: "png" });
const screenshot = `${outDir}/lcd-sketch-response.png`;
fs.writeFileSync(screenshot, Buffer.from(shot.data, "base64"));
const result = {
  loaded,
  beforeSim,
  state,
  backlightStates: [...observedBacklight],
  sketchLitColors: [...observedLitColors],
  screenshot,
  consoleErrors,
};
result.pass =
  loaded.partTypes.includes("lcd-16x2-i2c") &&
  loaded.wireCount === 4 &&
  ["idle", "stopped"].includes(beforeSim.simStatus) &&
  beforeSim.display === null &&
  beforeSim.metrics?.lines?.[0] === "" &&
  beforeSim.metrics?.lines?.[1] === "" &&
  beforeSim.metrics?.litPixels === 0 &&
  beforeSim.metrics?.backlight === false &&
  beforeSim.metrics?.powerConnected === true &&
  state.status === "running" &&
  state.error === null &&
  state.display?.lines?.[0] === "Hello, Vircuit!" &&
  state.metrics?.lines?.[0] === "Hello, Vircuit!" &&
  observedBacklight.has(true) &&
  observedBacklight.has(false) &&
  observedLitColors.size > 1 &&
  consoleErrors.length === 0;
const logFile = `${outDir}/acceptance-log.json`;
fs.writeFileSync(logFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, logFile }, null, 2));
ws.close();

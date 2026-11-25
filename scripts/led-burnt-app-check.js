"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require(path.join(__dirname, "..", "node_modules", "sharp"));

const root = path.resolve(__dirname, "..");
const reportPath = path.join(root, "reports", "led-burnt-app-check.json");
const FRAMES = 12;
const FRAME_DELAY = 500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let socket = null;

async function main() {
  const pages = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
  const page = pages.find((entry) => entry.type === "page");
  if (!page) throw new Error("Electron renderer page not found");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  socket = ws;
  let requestId = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++requestId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
    return response.result?.result?.value;
  }
  async function clickButton(match) {
    return evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((entry) => ${match}); if (!button) return false; button.click(); return true; })()`);
  }
  async function screenshot() {
    const response = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    if (!response.result?.data) throw new Error("screenshot failed");
    return Buffer.from(response.result.data, "base64");
  }
  async function countRedPixels() {
    const buffer = await screenshot();
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    const canvas = await evaluate(`(() => { const el = document.querySelector('canvas'); const rect = el.getBoundingClientRect(); return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; })()`);
    let count = 0;
    for (let y = Math.floor(canvas.top); y < canvas.top + canvas.height; y += 1) {
      for (let x = Math.floor(canvas.left); x < canvas.left + canvas.width; x += 1) {
        const offset = (y * info.width + x) * info.channels;
        if (data[offset] > 210 && data[offset + 1] < 120 && data[offset + 2] < 120) count += 1;
      }
    }
    return count;
  }
  const damageButtonText = () => evaluate(`document.querySelector('[data-testid="damage-button"]')?.innerText ?? null`);
  const failedParts = () => evaluate(`window.__LCD_DAMAGE_ENGINE__?.snapshot?.().failedParts ?? []`);

  await send("Runtime.enable");
  await send("Page.enable");

  await clickButton(`entry.innerText === 'Samples'`);
  await wait(300);
  const opened =   await clickButton(`entry.innerText.includes('traffic-light.vcc')`);
  if (!opened) throw new Error("Traffic light starter not found");
  await wait(700);
  await evaluate(`window.__LCD_DAMAGE_ENGINE__?.repairAll?.(); window.__LCD_SIM_STORE__?.setState?.({ failedParts: {} });`);
  await wait(600);

  const phases = [];
  const record = async (label) => {
    phases.push({
      label,
      damageButton: await damageButtonText(),
      failedParts: await failedParts(),
    });
  };
  const sampleRed = async (label) => {
    const counts = [];
    for (let index = 0; index < FRAMES; index += 1) {
      await wait(FRAME_DELAY);
      counts.push(await countRedPixels());
    }
    phases.push({ label, redPixelMax: Math.max(...counts), redPixelFrames: counts });
  };

  const started = await clickButton(`entry.dataset.testid === 'sim-button'`);
  if (!started) throw new Error("Simulation button not found");
  await wait(1200);
  await sampleRed("baseline-running");

  const burn = await evaluate(`(() => {
    const engine = window.__LCD_DAMAGE_ENGINE__;
    if (!engine) return false;
    engine.step({
      document: { parts: [{ id: "led1", type: "led", props: { color: "red" } }], wires: [] },
      solve: {
        ledCurrents: new Map([["led1", 0.5]]),
        netVoltages: new Map([["led1:anode", 5], ["led1:cathode", 0]]),
      },
      netlist: { netIdOf: ({ partId, pinId }) => partId + ":" + pinId },
      drivers: new Map(),
      deltaSeconds: 0.01,
      simMs: 0,
    });
    return engine.snapshot().failedParts.includes("led1");
  })()`);
  if (!burn) throw new Error("LED burn injection failed");
  await record("after-burn");
  await wait(800);
  await sampleRed("burnt-running");

  await clickButton(`entry.dataset.testid === 'sim-button'`);
  await wait(800);
  await record("after-stop");

  await clickButton(`entry.dataset.testid === 'sim-button'`);
  await wait(1200);
  await record("after-restart");
  await sampleRed("burnt-restarted");

  const panelOpen = await evaluate(`[...document.querySelectorAll('button')].some((entry) => entry.innerText === 'Repair all')`);
  if (!panelOpen) {
    await clickButton(`entry.dataset.testid === 'damage-button'`);
    await wait(300);
  }
  const repairedClicked = await clickButton(`entry.innerText === 'Repair all'`);
  if (!repairedClicked) throw new Error("Repair all button not found");
  await wait(800);
  await record("after-repair");
  await sampleRed("repaired-running");

  const byLabel = Object.fromEntries(phases.map((entry) => [entry.label, entry]));
  const baseline = byLabel["baseline-running"].redPixelMax;
  const burnt = byLabel["burnt-running"].redPixelMax;
  const restarted = byLabel["burnt-restarted"].redPixelMax;
  const repaired = byLabel["repaired-running"].redPixelMax;
  const report = {
    source: "embedded traffic-light.vcc starter",
    opened,
    burn,
    phases,
    runtimeExceptions: exceptions,
    pass:
      byLabel["after-burn"].failedParts.includes("led1") &&
      byLabel["after-stop"].failedParts.includes("led1") &&
      byLabel["after-restart"].failedParts.includes("led1") &&
      byLabel["after-repair"].failedParts.length === 0 &&
      baseline >= 20 &&
      burnt <= 2 &&
      restarted <= 2 &&
      repaired >= 20 &&
      exceptions.length === 0,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const entry of phases) {
    const failed = entry.failedParts ? entry.failedParts.join(",") || "none" : "";
    const red = entry.redPixelMax === undefined ? "" : ` red_max=${entry.redPixelMax}`;
    console.log(`${entry.label}: button=${entry.damageButton ?? "-"}${failed ? ` failed=${failed}` : ""}${red}`);
  }
  console.log(`runtime_exceptions=${exceptions.length}`);
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(report.pass ? "BURNT APP CHECK: PASS" : "BURNT APP CHECK: FAIL");
  ws.close();
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  socket?.close();
});

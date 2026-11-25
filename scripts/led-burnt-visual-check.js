"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require(path.join(__dirname, "..", "node_modules", "sharp"));

const root = path.resolve(__dirname, "..");
const reportPath = path.join(root, "reports", "led-burnt-visual-check.json");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const pages = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
  const page = pages.find((entry) => entry.type === "page");
  if (!page) throw new Error("Electron renderer page not found");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
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
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++requestId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
    return response.result?.result?.value;
  };
  const clickButton = (match) => evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((entry) => ${match}); if (!button) return false; button.click(); return true; })()`);
  const screenshot = async () => {
    const response = await send("Page.captureScreenshot", { format: "png" });
    if (!response.result?.data) throw new Error("screenshot failed");
    return Buffer.from(response.result.data, "base64");
  };
  const canvasBox = () => evaluate(`(() => { const el = document.querySelector('canvas'); const rect = el.getBoundingClientRect(); return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; })()`);
  const frame = async () => {
    const buffer = await screenshot();
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    return { data, info };
  };
  const pixel = (image, x, y) => {
    const offset = (y * image.info.width + x) * image.info.channels;
    return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
  };
  const isGrey = ([r, g, b]) => Math.abs(r - g) < 18 && Math.abs(g - b) < 18 && r > 90;
  const isDark = ([r, g, b]) => r < 70 && g < 70 && b < 70;
  const isWarm = ([r, g, b]) => r > 90 && r - b > 45 && g > b && g < r;
  const countInCanvas = (image, box, predicate) => {
    let count = 0;
    for (let y = Math.floor(box.top); y < box.top + box.height; y += 1) {
      for (let x = Math.floor(box.left); x < box.left + box.width; x += 1) {
        if (predicate(pixel(image, x, y))) count += 1;
      }
    }
    return count;
  };

  await send("Runtime.enable");
  await send("Page.enable");

  await clickButton(`entry.innerText === 'Samples'`);
  await wait(300);
  const opened = await clickButton(`entry.innerText.includes('traffic-light.vcc')`);
  if (!opened) throw new Error("Traffic light starter not found");
  await wait(800);
  await clickButton(`entry.title === 'Switch to dark theme'`);
  await wait(400);
  await evaluate(`window.__LCD_DAMAGE_ENGINE__?.repairAll?.(); window.__LCD_SIM_STORE__?.setState?.({ failedParts: {} });`);
  await wait(600);

  const box = await canvasBox();
  const phases = [];
  const greyCount = async (label) => {
    const image = await frame();
    const count = countInCanvas(image, box, isGrey);
    phases.push({ label, greyPixels: count });
    return count;
  };

  const baseline = await greyCount("baseline");
  await evaluate(`(() => {
    const engine = window.__LCD_DAMAGE_ENGINE__;
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
    window.__LCD_SIM_STORE__?.setState?.({ failedParts: { led1: true } });
    return true;
  })()`);
  await wait(700);
  const atBurn = await greyCount("at-burn");
  const decay = [];
  for (const waitMs of [1000, 2000, 3000, 4000, 5000]) {
    await wait(waitMs);
    decay.push(await greyCount(`after-${waitMs}ms`));
  }
  const faded = decay[decay.length - 1];

  await clickButton(`entry.dataset.testid === 'sim-button'`);
  await wait(1200);
  await clickButton(`entry.dataset.testid === 'sim-button'`);
  await wait(1500);
  const afterRestart = await greyCount("after-restart");

  await clickButton(`entry.title === 'Switch to light theme'`);
  await wait(600);
  await evaluate(`window.__LCD_DAMAGE_ENGINE__?.repairAll?.(); window.__LCD_SIM_STORE__?.setState?.({ failedParts: {} });`);
  await wait(800);
  const lightBefore = await frame();
  await evaluate(`(() => {
    const engine = window.__LCD_DAMAGE_ENGINE__;
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
    window.__LCD_SIM_STORE__?.setState?.({ failedParts: { led1: true } });
    return true;
  })()`);
  await wait(12000);
  const lightAfter = await frame();
  const lightBox = await canvasBox();
  const isRed = ([r, g, b]) => r >= 150 && r <= 235 && g < 110 && b < 110;
  let minX = 1e9;
  let minY = 1e9;
  let maxX = -1;
  let maxY = -1;
  let removed = 0;
  for (let y = Math.floor(lightBox.top); y < lightBox.top + lightBox.height; y += 1) {
    for (let x = Math.floor(lightBox.left); x < lightBox.left + lightBox.width; x += 1) {
      const before = pixel(lightBefore, x, y);
      const after = pixel(lightAfter, x, y);
      if (isRed(before) && !isRed(after)) {
        removed += 1;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  let darkInside = 0;
  let warmInside = 0;
  let darkLeftBand = 0;
  for (let y = minY - 2; y <= maxY + 2; y += 1) {
    for (let x = minX - 10; x <= maxX + 2; x += 1) {
      const value = pixel(lightAfter, x, y);
      const inside = x >= minX && x <= maxX && y >= minY && y <= maxY;
      if (inside) {
        if (isDark(value)) darkInside += 1;
        if (isWarm(value)) warmInside += 1;
      } else if (x >= minX - 10 && x <= minX - 2 && y >= minY + 1 && y <= maxY - 1) {
        if (isDark(value)) darkLeftBand += 1;
      }
    }
  }
  const bulbPixels = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
  const lightTheme = {
    bulb_box: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
    removed_red_pixels: removed,
    dark_bulb_pixels: darkInside,
    dark_bulb_ratio: Number((darkInside / bulbPixels).toFixed(3)),
    warm_icon_pixels: warmInside,
    dark_oval_pixels: darkLeftBand,
  };

  const report = {
    source: "embedded traffic-light.vcc starter",
    opened,
    phases,
    decay,
    baseline,
    atBurn,
    faded,
    afterRestart,
    light_theme: lightTheme,
    runtimeExceptions: exceptions,
    pass:
      atBurn > baseline &&
      faded <= baseline + 5 &&
      afterRestart <= baseline + 5 &&
      lightTheme.removed_red_pixels >= 20 &&
      lightTheme.dark_bulb_ratio >= 0.5 &&
      lightTheme.warm_icon_pixels >= 4 &&
      lightTheme.dark_oval_pixels === 0 &&
      exceptions.length === 0,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const phase of phases) console.log(`${phase.label}: grey=${phase.greyPixels}`);
  console.log(`light_theme=${JSON.stringify(lightTheme)}`);
  console.log(`runtime_exceptions=${exceptions.length}`);
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(report.pass ? "BURNT VISUAL CHECK: PASS" : "BURNT VISUAL CHECK: FAIL");
  ws.close();
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

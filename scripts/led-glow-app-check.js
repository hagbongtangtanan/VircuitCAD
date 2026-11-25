"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require(path.join(__dirname, "..", "node_modules", "sharp"));

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "led-new", "out", "glow");
const reportPath = path.join(root, "reports", "led-glow-app-check.json");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
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
  async function screenshot() {
    const response = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    if (!response.result?.data) throw new Error("screenshot failed");
    return Buffer.from(response.result.data, "base64");
  }
  async function clickButton(match) {
    return evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((entry) => ${match}); if (!button) return false; button.click(); return true; })()`);
  }
  async function detectAndCrop(buffer, theme, zoom, frame) {
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    const detections = [];
    const rules = {
      red: (r, g, b) => r > 155 && g < 135 && b < 135,
      yellow: (r, g, b) => r > 155 && g > 125 && b < 115,
      green: (r, g, b) => g > 120 && r < 155 && b < 135,
    };
    for (const [color, matches] of Object.entries(rules)) {
      let minX = info.width;
      let minY = info.height;
      let maxX = -1;
      let maxY = -1;
      let count = 0;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          const offset = (y * info.width + x) * info.channels;
          if (matches(data[offset], data[offset + 1], data[offset + 2])) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            count += 1;
          }
        }
      }
      if (count < 20 || maxX < 0) continue;
      const centerX = Math.round((minX + maxX) / 2);
      const centerY = Math.round((minY + maxY) / 2);
      const cropSize = zoom === 1 ? 150 : 260;
      const left = Math.max(0, Math.min(info.width - cropSize, centerX - Math.floor(cropSize / 2)));
      const top = Math.max(0, Math.min(info.height - cropSize, centerY - Math.floor(cropSize / 2)));
      const file = path.join(outputDir, `traffic-${color}-${theme}-zoom${zoom}-${frame}.png`);
      await sharp(buffer).extract({ left, top, width: cropSize, height: cropSize }).png().toFile(file);
      detections.push({ color, count, centerX, centerY, crop: { left, top, width: cropSize, height: cropSize }, file: path.relative(root, file).split(path.sep).join("/") });
    }
    return detections;
  }

  await send("Runtime.enable");
  await send("Page.enable");
  const samplesClicked = await clickButton(`entry.innerText === 'Samples'`);
  if (samplesClicked) await wait(300);
  const opened = await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((entry) => entry.innerText.includes('traffic-light.vcc')); if (!button) return false; button.click(); return true; })()`);
  if (!opened) throw new Error("Traffic light starter not found");
  await wait(700);
  const text = await evaluate("document.body.innerText");
  if (!text.includes("Traffic light")) throw new Error("Traffic light starter did not load");

  const crops = [];
  for (const theme of ["dark", "light"]) {
    const currentTheme = await evaluate("document.documentElement.dataset.theme");
    if (currentTheme !== theme) {
      await clickButton(`entry.title === 'Switch to ${theme === "dark" ? "light" : "dark"} theme'`);
      await wait(300);
    }
    for (const zoom of [1, 2]) {
      await clickButton(`entry.title === 'Reset zoom to 100%'`);
      await wait(100);
      if (zoom === 2) {
        for (let index = 0; index < 4; index += 1) await clickButton(`entry.title === 'Zoom in'`);
        await wait(300);
      }
      const label = await evaluate(`[...document.querySelectorAll('button')].find((entry) => entry.title === 'Reset zoom to 100%')?.innerText`);
      const buffer = await screenshot();
      const fullFile = path.join(outputDir, `traffic-${theme}-zoom${zoom}-full.png`);
      fs.writeFileSync(fullFile, buffer);
      const detections = await detectAndCrop(buffer, theme, zoom, "still");
      crops.push({ theme, zoom, label, full: path.relative(root, fullFile).split(path.sep).join("/"), detections });
    }
  }

  await clickButton(`entry.innerText.includes('Start simulation')`);
  const frames = [];
  for (let index = 0; index < 12; index += 1) {
    await wait(500);
    const buffer = await screenshot();
    const detections = await detectAndCrop(buffer, "simulation", 1, String(index).padStart(2, "0"));
    frames.push({ index, detections });
  }
  const observed = {
    red: frames.some((frame) => frame.detections.some((detection) => detection.color === "red")),
    yellow: frames.some((frame) => frame.detections.some((detection) => detection.color === "yellow")),
    green: frames.some((frame) => frame.detections.some((detection) => detection.color === "green")),
  };
  const report = {
    source: "embedded uno-traffic-light.vcc starter",
    opened,
    crops,
    frames,
    observed,
    runtimeExceptions: exceptions,
    pass: crops.every((entry) => entry.detections.length >= 3) && Object.values(observed).every(Boolean) && exceptions.length === 0,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`app_crops=${crops.length}`);
  for (const crop of crops) console.log(`app_${crop.theme}_zoom${crop.zoom}=${crop.detections.map((entry) => entry.color).join(",")}`);
  console.log(`app_observed_red=${Number(report.observed.red)}`);
  console.log(`app_observed_yellow=${Number(report.observed.yellow)}`);
  console.log(`app_observed_green=${Number(report.observed.green)}`);
  console.log(`app_runtime_exceptions=${report.runtimeExceptions.length}`);
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(report.pass ? "GLOW APP CHECK: PASS" : "GLOW APP CHECK: FAIL");
  ws.close();
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require(path.join(__dirname, "..", "node_modules", "sharp"));

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "led-new", "out", "app-clips");
const reportPath = path.join(root, "reports", "led-app-regression.json");

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
  async function screenshot(name) {
    const response = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    if (!response.result?.data) throw new Error(`screenshot failed: ${name}`);
    const file = path.join(outputDir, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(response.result.data, "base64"));
    return file;
  }
  async function clickButton(match) {
    return evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((entry) => ${match}); if (!button) return false; button.click(); return true; })()`);
  }
  async function colorCounts(file) {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const counts = { red: 0, green: 0, yellow: 0, white: 0 };
    for (let offset = 0; offset < data.length; offset += info.channels) {
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (r > 180 && g < 135 && b < 135) counts.red += 1;
      if (g > 135 && r < 155 && b < 155) counts.green += 1;
      if (r > 175 && g > 135 && b < 115) counts.yellow += 1;
      if (r > 220 && g > 220 && b > 220) counts.white += 1;
    }
    return counts;
  }

  await send("Runtime.enable");
  await send("Page.enable");
  const initial = await evaluate(`({title:document.title, theme:document.documentElement.dataset.theme, text:document.body.innerText})`);
  if (!initial.text.includes("Traffic light")) throw new Error("traffic-light sample is not open");
  const clicks = {
    zoomIn: await clickButton(`entry.title === "Zoom in"`),
    theme: await clickButton(`entry.title === "Switch to light theme"`),
  };
  await wait(500);
  const darkZoom1 = await screenshot("traffic-dark-zoom1");
  await clickButton(`entry.title === "Zoom in"`);
  await wait(500);
  const darkZoom2 = await screenshot("traffic-dark-zoom2");
  const lightState = await evaluate(`({theme:document.documentElement.dataset.theme})`);
  await clickButton(`entry.title === "Switch to dark theme"`);
  await wait(400);
  await clickButton(`entry.innerText.includes("Start simulation")`);
  const frames = [];
  for (let index = 0; index < 12; index += 1) {
    await wait(500);
    const file = await screenshot(`traffic-sim-${String(index).padStart(2, "0")}`);
    frames.push({ file: path.relative(root, file).split(path.sep).join("/"), colors: await colorCounts(file) });
  }
  const observed = {
    red: frames.some((frame) => frame.colors.red >= 20),
    green: frames.some((frame) => frame.colors.green >= 20),
    yellow: frames.some((frame) => frame.colors.yellow >= 20),
  };
  const report = {
    title: initial.title,
    initialTheme: initial.theme,
    clicks,
    lightThemeObserved: lightState.theme,
    screenshots: ["traffic-dark-zoom1", "traffic-dark-zoom2"],
    frames,
    observed,
    runtimeExceptions: exceptions,
    pass:
      clicks.zoomIn === true &&
      clicks.theme === true &&
      lightState.theme === "light" &&
      Object.values(observed).every(Boolean) &&
      exceptions.length === 0,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`app_title=${report.title}`);
  console.log(`app_theme=${report.initialTheme}->${report.lightThemeObserved}`);
  console.log(`app_observed_red=${Number(report.observed.red)}`);
  console.log(`app_observed_green=${Number(report.observed.green)}`);
  console.log(`app_observed_yellow=${Number(report.observed.yellow)}`);
  console.log(`app_runtime_exceptions=${report.runtimeExceptions.length}`);
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(report.pass ? "APP REGRESSION: PASS" : "APP REGRESSION: FAIL");
  ws.close();
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

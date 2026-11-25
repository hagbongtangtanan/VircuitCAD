"use strict";

/**
 * Checks that a selected resistor keeps its selection outline in light mode.
 *
 * The resistor graphic used to compare the outline colour with the dark mode
 * yellow, so in light mode the selection ring was never drawn.
 *
 * Usage:
 *   node scripts/resistor-selection-check.js [--app out/app-multi-window.asar]
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const electronBinary = path.join(root, "node_modules", "electron", "dist", "electron");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value: --${name}`);
  return value;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findPage(port) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      const page = pages.find((entry) => entry.type === "page");
      if (page) return page;
    } catch {
    }
    await sleep(200);
  }
  throw new Error("no renderer page appeared");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const exceptions = [];
    let requestId = 0;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        exceptions.push(String(message.params.exceptionDetails.text).slice(0, 300));
      }
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    };
    socket.onopen = () =>
      resolve({
        exceptions,
        close: () => socket.close(),
        send(method, params = {}) {
          return new Promise((resolveCall) => {
            const id = ++requestId;
            pending.set(id, resolveCall);
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
      });
    socket.onerror = () => reject(new Error("cdp socket error"));
  });
}

function countColor(data, info, hex, tolerance = 26) {
  const value = hex.replace("#", "");
  const [r, g, b] = [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
  let total = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    if (
      Math.abs(data[index] - r) <= tolerance &&
      Math.abs(data[index + 1] - g) <= tolerance &&
      Math.abs(data[index + 2] - b) <= tolerance
    ) {
      total += 1;
    }
  }
  return total;
}

async function main() {
  const port = Number(arg("port", "9379"));
  const appPath = resolveInput(arg("app", "out/app-multi-window.asar"));
  const reportPath = resolveInput(arg("report", "reports/resistor-selection-check.json"));

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-resistor-check-"));
  const child = spawn(
    electronBinary,
    [appPath, `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, "--no-sandbox"],
    { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  let client = null;
  try {
    const page = await findPage(port);
    client = await connect(page.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    const evaluate = async (expression) => {
      const response = await client.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (response.result?.exceptionDetails) {
        throw new Error(String(response.result.exceptionDetails.text).slice(0, 300));
      }
      return response.result?.result?.value;
    };

    await sleep(3000);
    await evaluate(
      `(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.innerText.includes("already know")); if (button) button.click(); return true; })()`,
    );
    await sleep(1000);

    const canvasBox = JSON.parse(
      await evaluate(`(() => {
        const canvas = document.querySelector('[data-testid="circuit-canvas"]');
        const rect = canvas.getBoundingClientRect();
        return JSON.stringify({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      })()`),
    );

    const placeResistor = async () => {
      const placed = await evaluate(`(() => {
        const card = document.querySelector('[data-part-type="resistor"]');
        if (card === null) return false;
        card.scrollIntoView({ block: "center" });
        card.click();
        return true;
      })()`);
      await sleep(1200);
      return placed;
    };

    const selectionPixels = async (hex) => {
      const shot = await client.send("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(shot.result.data, "base64");
      const crop = {
        left: Math.max(0, Math.round(canvasBox.x + canvasBox.width / 2 - 90)),
        top: Math.max(0, Math.round(canvasBox.y + canvasBox.height / 2 - 90)),
        width: 180,
        height: 180,
      };
      const image = sharp(buffer);
      const info = await image.metadata();
      crop.width = Math.min(crop.width, info.width - crop.left);
      crop.height = Math.min(crop.height, info.height - crop.top);
      const { data, info: raw } = await image
        .extract(crop)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return countColor(data, raw, hex);
    };

    const placed = await placeResistor();
    const darkTheme = await evaluate(`document.documentElement.dataset.theme`);
    const darkPixels = await selectionPixels("#ffc928");

    await evaluate(`(() => { const button = document.querySelector('[data-testid="theme-toggle"]'); if (button) button.click(); return true; })()`);
    await sleep(1200);
    const lightTheme = await evaluate(`document.documentElement.dataset.theme`);
    const lightPixels = await selectionPixels("#8a5a00");

    const checks = {
      resistor_placed: placed === true,
      dark_theme_active: darkTheme === "dark",
      light_theme_active: lightTheme === "light",
      dark_selection_visible: darkPixels >= 20,
      light_selection_visible: lightPixels >= 20,
      no_runtime_exceptions: client.exceptions.length === 0,
    };

    const report = {
      app: path.relative(root, appPath).split(path.sep).join("/"),
      canvas: canvasBox,
      dark_theme: darkTheme,
      light_theme: lightTheme,
      dark_selection_pixels: darkPixels,
      light_selection_pixels: lightPixels,
      checks,
      runtimeExceptions: client.exceptions,
    };
    report.pass = Object.values(report.checks).every((value) => value === true);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`dark_theme=${darkTheme} selection_pixels=${darkPixels}`);
    console.log(`light_theme=${lightTheme} selection_pixels=${lightPixels}`);
    for (const [name, value] of Object.entries(checks)) {
      console.log(`${name}=${Number(value)}`);
    }
    console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
    console.log(report.pass ? "RESISTOR SELECTION CHECK: PASS" : "RESISTOR SELECTION CHECK: FAIL");
    if (!report.pass) process.exitCode = 1;
  } finally {
    if (client !== null) client.close();
    child.kill("SIGTERM");
    await sleep(800);
    if (!child.killed) child.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

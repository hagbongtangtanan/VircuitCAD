"use strict";

/**
 * Samples the breadboard cream, the red rail and the blue rail from the real
 * app canvas, so the potentiometer checks run against the colours the canvas
 * actually paints.
 *
 * The pixels are read straight out of the Konva layer canvases in the running
 * renderer (getImageData), not from a screenshot, so the sampled values are
 * the exact painted colours.
 *
 * Usage:
 *   node scripts/pot-backgrounds.js [--port <cdp port>] [--report <path>]
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const electronBinary = path.join(root, "node_modules", "electron", "dist", "electron");
const defaultRuntime = path.join(root, "resources", "app.asar");
const sample = path.join(root, "resources", "samples", "blink-led.vcc");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value: --${name}`);
  return value;
}

const port = Number(arg("port", "9335"));
const reportPath = path.resolve(root, arg("report", "reports/pot-backgrounds.json"));
const runtime = path.resolve(root, arg("app", path.relative(root, defaultRuntime)));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findPage() {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      const page = pages.find((entry) => entry.type === "page");
      if (page) return page;
    } catch {
    }
    await sleep(250);
  }
  throw new Error("no renderer page appeared");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let requestId = 0;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    };
    socket.onopen = () =>
      resolve({
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

const SCAN_SCRIPT = `(() => {
  const canvases = [...document.querySelectorAll("canvas")];
  const counts = new Map();
  let scanned = 0;
  for (const canvas of canvases) {
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) continue;
    let data;
    try {
      data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch {
      continue;
    }
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] === 0) continue;
      const key = (data[index] << 16) | (data[index + 1] << 8) | data[index + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    scanned += 1;
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return JSON.stringify({
    canvases: canvases.length,
    scanned,
    top: entries.slice(0, 600).map(([key, count]) => ({
      hex: "#" + [key >> 16 & 255, key >> 8 & 255, key & 255].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase(),
      pixels: count,
    })),
  });
})()`;

function pick(candidates, match, label) {
  for (const candidate of candidates) {
    const r = parseInt(candidate.hex.slice(1, 3), 16);
    const g = parseInt(candidate.hex.slice(3, 5), 16);
    const b = parseInt(candidate.hex.slice(5, 7), 16);
    if (match(r, g, b)) return { hex: candidate.hex, pixels: candidate.pixels };
  }
  throw new Error(`could not sample ${label}`);
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vcircuitcad-pot-bg-"));
  const child = spawn(
    electronBinary,
    [runtime, sample, `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, "--no-sandbox"],
    { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  try {
    const page = await findPage();
    const client = await connect(page.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await client.send("Page.enable");

    const evaluate = async (expression) => {
      const response = await client.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (response.result?.exceptionDetails) {
        throw new Error(response.result.exceptionDetails.text);
      }
      return response.result?.result?.value;
    };

    const dismissed = await evaluate(
      `(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.innerText.includes("already know")); if (!button) return true; button.click(); return true; })()`,
    );
    if (!dismissed) throw new Error("could not dismiss the orientation dialog");
    await sleep(600);

    const fitClicked = await evaluate(
      `(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.title === "Fit the circuit to the window"); if (!button) return false; button.click(); return true; })()`,
    );
    if (!fitClicked) throw new Error("could not fit the circuit to the window");
    await sleep(1200);

    let theme = "dark";
    let scan = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await sleep(500);
      const raw = await evaluate(SCAN_SCRIPT);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed.scanned > 0 && parsed.top.length > 0) {
        scan = parsed;
        break;
      }
    }
    if (!scan) throw new Error("the app canvas never produced pixels");
    theme = await evaluate(`document.documentElement.dataset.theme ?? "dark"`);

    const lightButton = await evaluate(
      `(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.title === "Switch to light theme"); if (!button) return false; button.click(); return true; })()`,
    );
    if (!lightButton) throw new Error("could not switch to the light theme");
    await sleep(800);
    const lightRaw = await evaluate(SCAN_SCRIPT);
    const lightScan = JSON.parse(lightRaw);

    const report = {
      source: "live app canvas pixels (Konva layer canvases, getImageData)",
      runtime: path.relative(root, runtime),
      dark: {
        theme,
        canvases: scan.canvases,
        cream: pick(scan.top, (r, g, b) => r >= 200 && r <= 240 && g >= 195 && g <= 232 && b >= 185 && b <= 220, "dark board cream"),
        redRail: pick(scan.top, (r, g, b) => r >= 170 && g <= 110 && b <= 110, "dark red rail"),
        blueRail: pick(scan.top, (r, g, b) => b >= 150 && r <= 110 && g <= 160, "dark blue rail"),
      },
      light: {
        theme: await evaluate(`document.documentElement.dataset.theme ?? "light"`),
        canvases: lightScan.canvases,
        cream: pick(lightScan.top, (r, g, b) => r >= 200 && r <= 240 && g >= 195 && g <= 232 && b >= 185 && b <= 220, "light board cream"),
        redRail: pick(lightScan.top, (r, g, b) => r >= 170 && g <= 110 && b <= 110, "light red rail"),
        blueRail: pick(lightScan.top, (r, g, b) => b >= 150 && r <= 110 && g <= 160, "light blue rail"),
      },
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    for (const variant of ["dark", "light"]) {
      const entry = report[variant];
      console.log(`${variant}: cream ${entry.cream.hex} (${entry.cream.pixels} px)`);
      console.log(`${variant}: red rail ${entry.redRail.hex} (${entry.redRail.pixels} px)`);
      console.log(`${variant}: blue rail ${entry.blueRail.hex} (${entry.blueRail.pixels} px)`);
    }
    console.log(`report ${path.relative(root, reportPath)}`);
  } finally {
    child.kill("SIGTERM");
    await sleep(600);
    if (!child.killed) child.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

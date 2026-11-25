"use strict";

/**
 * Measures how the canvas behaves while the user navigates (pans) around,
 * with the developer tools closed and with them open.
 *
 * Usage:
 *   node scripts/devtools-lag-check.js [--app out/app-library-sections.asar]
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

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

async function findTarget(port, predicate) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const target = targets.find(predicate);
      if (target) return target;
    } catch {
    }
    await sleep(200);
  }
  throw new Error("no debug target appeared");
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

function stats(frames) {
  const sorted = [...frames].sort((a, b) => a - b);
  const pick = (ratio) => (sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count: sorted.length,
    p50: pick(0.5),
    p95: pick(0.95),
    max: sorted.length === 0 ? 0 : sorted[sorted.length - 1],
    mean: sorted.length === 0 ? 0 : sum / sorted.length,
    over16: sorted.filter((value) => value > 16.7).length,
    over33: sorted.filter((value) => value > 33.3).length,
  };
}

async function main() {
  const port = Number(arg("port", "9361"));
  const inspectorPort = port + 100;
  const appPath = resolveInput(arg("app", "out/app-library-sections.asar"));
  const reportPath = resolveInput(arg("report", "reports/devtools-lag-check.json"));

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-devtools-lag-"));
  const child = spawn(
    electronBinary,
    [
      appPath,
      `--remote-debugging-port=${port}`,
      `--inspect=${inspectorPort}`,
      `--user-data-dir=${userDataDir}`,
      "--no-sandbox",
    ],
    { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  let client = null;
  let inspector = null;
  try {
    const pageTarget = await findTarget(port, (entry) => entry.type === "page");
    client = await connect(pageTarget.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
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
    await sleep(800);
    const sample = arg("sample", "traffic-light.vcc");
    if (sample !== "none") {
      await evaluate(`(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.innerText === "Samples"); if (button) button.click(); return true; })()`);
      await sleep(600);
      await evaluate(`(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.innerText.includes(${JSON.stringify(sample)})); if (button) button.click(); return true; })()`);
      await sleep(1500);
    }

    const canvasBox = JSON.parse(
      await evaluate(`(() => {
        const canvas = document.querySelector('[data-testid="circuit-canvas"]');
        const rect = canvas.getBoundingClientRect();
        return JSON.stringify({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      })()`),
    );

    const measure = async (label) => {
      await evaluate(`(() => {
        window.__LAG_FRAMES__ = [];
        window.__LAG_CTX__ = 0;
        const context = CanvasRenderingContext2D.prototype;
        if (!context.__vcPatched) {
          for (const name of ["fill", "stroke", "fillRect", "strokeRect", "drawImage", "clearRect", "lineTo", "arc"]) {
            const original = context[name];
            context[name] = function (...args) {
              window.__LAG_CTX__ += 1;
              window.__LAG_PAN_CTX__ += 1;
              return original.apply(this, args);
            };
          }
          context.__vcPatched = true;
        }
        if (window.__LAG_RAF__) cancelAnimationFrame(window.__LAG_RAF__);
        let last = 0;
        const tick = (now) => {
          if (last > 0) window.__LAG_FRAMES__.push(now - last);
          last = now;
          window.__LAG_RAF__ = requestAnimationFrame(tick);
        };
        window.__LAG_RAF__ = requestAnimationFrame(tick);
        return true;
      })()`);
      await evaluate(`(() => { window.__LAG_PAN_CTX__ = 0; return true; })()`);
      await sleep(200);

      const startX = canvasBox.x + canvasBox.width * 0.6;
      const startY = canvasBox.y + canvasBox.height * 0.55;
      await client.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: startX,
        y: startY,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      for (let step = 1; step <= 40; step += 1) {
        await client.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: startX - step * 4,
          y: startY - step * 2,
          button: "left",
          buttons: 1,
        });
        await sleep(16);
      }
      await client.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: startX - 160,
        y: startY - 80,
        button: "left",
        buttons: 0,
        clickCount: 1,
      });
      await sleep(400);

      const frames = await evaluate(`JSON.stringify(window.__LAG_FRAMES__.slice(1))`);
      const ctxOps = await evaluate(`window.__LAG_PAN_CTX__`);
      await evaluate(`(() => { if (window.__LAG_RAF__) cancelAnimationFrame(window.__LAG_RAF__); return true; })()`);
      const parsed = JSON.parse(frames);
      return { label, frames: stats(parsed), ctxOps, rawCount: parsed.length };
    };

    const withoutDevTools = await measure("without-devtools");

    const inspectorTarget = await findTarget(inspectorPort, (entry) => entry.webSocketDebuggerUrl);
    inspector = await connect(inspectorTarget.webSocketDebuggerUrl);
    await inspector.send("Runtime.enable");
    await inspector.send("Runtime.evaluate", {
      expression: `(() => { const electron = process.mainModule.require("electron"); for (const window of electron.BrowserWindow.getAllWindows()) window.openDevTools({ mode: "right" }); return electron.BrowserWindow.getAllWindows().length; })()`,
      returnByValue: true,
    });
    await sleep(4000);

    const withDevTools = await measure("with-devtools");

    const report = {
      app: path.relative(root, appPath).split(path.sep).join("/"),
      canvas: canvasBox,
      without_devtools: withoutDevTools,
      with_devtools: withDevTools,
      runtimeExceptions: client.exceptions,
    };
    const checks = {
      pan_draw_calls_bounded:
        withoutDevTools.ctxOps <= 120000 && withDevTools.ctxOps <= 120000,
      frames_measured: withoutDevTools.frames.count > 10 && withDevTools.frames.count > 10,
      no_runtime_exceptions: client.exceptions.length === 0,
    };
    report.checks = checks;
    report.pass = Object.values(checks).every((value) => value === true);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`without_devtools frames=${withoutDevTools.frames.count} p50=${withoutDevTools.frames.p50.toFixed(2)} p95=${withoutDevTools.frames.p95.toFixed(2)} max=${withoutDevTools.frames.max.toFixed(2)} over16=${withoutDevTools.frames.over16} ctx=${withoutDevTools.ctxOps}`);
    console.log(`with_devtools    frames=${withDevTools.frames.count} p50=${withDevTools.frames.p50.toFixed(2)} p95=${withDevTools.frames.p95.toFixed(2)} max=${withDevTools.frames.max.toFixed(2)} over16=${withDevTools.frames.over16} ctx=${withDevTools.ctxOps}`);
    for (const [name, value] of Object.entries(checks)) {
      console.log(`${name}=${Number(value)}`);
    }
    console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
    console.log(report.pass ? "DEVTOOLS LAG CHECK: PASS" : "DEVTOOLS LAG CHECK: FAIL");
    if (!report.pass) process.exitCode = 1;
  } finally {
    if (client !== null) client.close();
    if (inspector !== null) inspector.close();
    child.kill("SIGTERM");
    await sleep(800);
    if (!child.killed) child.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

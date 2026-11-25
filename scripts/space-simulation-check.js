"use strict";

/**
 * Checks the spacebar shortcut for the simulation in a running app build:
 *
 *  - a short press of the spacebar starts the sketch on the simulated board,
 *  - a second press stops it again,
 *  - holding the spacebar and dragging the canvas still pans the circuit and
 *    does not touch the simulation,
 *  - typing a space in the code editor does not touch the simulation either.
 *
 * Usage:
 *   node scripts/space-simulation-check.js [--app out/app-space.asar] [--port <cdp port>]
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
  for (let attempt = 0; attempt < 200; attempt += 1) {
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
        exceptions.push(
          String(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text).slice(0, 400),
        );
      }
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    };
    socket.onopen = () =>
      resolve({
        exceptions,
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

async function main() {
  const port = Number(arg("port", "9372"));
  const appPath = resolveInput(arg("app", "out/app-space.asar"));
  const reportPath = resolveInput(arg("report", "reports/space-simulation-check.json"));
  const outDir = resolveInput(arg("out", "out/space-simulation"));

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-space-check-"));
  const child = spawn(
    electronBinary,
    [appPath, `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, "--no-sandbox"],
    { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  try {
    const page = await findPage(port);
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
        throw new Error(String(response.result.exceptionDetails.text).slice(0, 300));
      }
      return response.result?.result?.value;
    };
    const status = async () =>
      evaluate(`window.__LCD_SIM_STORE__ ? window.__LCD_SIM_STORE__.getState().status : "no store"`);
    const pressSpace = async () => {
      await client.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: " ",
        code: "Space",
        windowsVirtualKeyCode: 32,
        nativeVirtualKeyCode: 32,
        text: " ",
      });
      await sleep(60);
      await client.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: " ",
        code: "Space",
        windowsVirtualKeyCode: 32,
        nativeVirtualKeyCode: 32,
      });
    };

    await sleep(3500);
    await evaluate(
      `(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.innerText.includes("already know")); if (button) button.click(); return true; })()`,
    );
    await sleep(900);

    const before = await status();
    await pressSpace();
    await sleep(2500);
    const afterStart = await status();
    const codePanelOpen = await evaluate(
      `(() => { const panel = document.querySelector('[data-testid="code-panel"]'); return panel !== null; })()`,
    );

    await pressSpace();
    await sleep(1200);
    const afterStop = await status();

    const panBefore = await client.send("Page.captureScreenshot", { format: "png" });
    const panBeforeBuffer = Buffer.from(panBefore.result.data, "base64");
    const canvasBox = JSON.parse(
      await evaluate(`(() => {
        const canvas = document.querySelector('[data-testid="circuit-canvas"]');
        const rect = canvas.getBoundingClientRect();
        return JSON.stringify({ x: rect.left + rect.width * 0.4, y: rect.top + rect.height * 0.5 });
      })()`),
    );
    await client.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: " ",
      code: "Space",
      windowsVirtualKeyCode: 32,
      nativeVirtualKeyCode: 32,
      text: " ",
    });
    await client.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: canvasBox.x,
      y: canvasBox.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    for (let step = 1; step <= 8; step += 1) {
      await client.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: canvasBox.x + step * 12,
        y: canvasBox.y + step * 6,
        button: "left",
        buttons: 1,
      });
      await sleep(50);
    }
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: canvasBox.x + 96,
      y: canvasBox.y + 48,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await sleep(200);
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: " ",
      code: "Space",
      windowsVirtualKeyCode: 32,
      nativeVirtualKeyCode: 32,
    });
    await sleep(900);
    const afterPan = await status();
    const panAfter = await client.send("Page.captureScreenshot", { format: "png" });
    const panAfterBuffer = Buffer.from(panAfter.result.data, "base64");

    const panImage = await sharp(panAfterBuffer).raw().toBuffer({ resolveWithObject: true });
    const panBeforeImage = await sharp(panBeforeBuffer).raw().toBuffer({ resolveWithObject: true });
    let panChanged = 0;
    for (let index = 0; index < panImage.data.length; index += panImage.info.channels) {
      if (
        panImage.data[index] !== panBeforeImage.data[index] ||
        panImage.data[index + 1] !== panBeforeImage.data[index + 1] ||
        panImage.data[index + 2] !== panBeforeImage.data[index + 2]
      ) {
        panChanged += 1;
      }
    }

    await evaluate(`(() => {
      const content = document.querySelector(".cm-content");
      if (content !== null) content.focus();
      return content !== null;
    })()`);
    const editorFocused = await evaluate(
      `(() => { const active = document.activeElement; return active !== null && active.classList.contains("cm-content"); })()`,
    );
    await pressSpace();
    await sleep(900);
    const afterEditorSpace = await status();

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "canvas-after-pan.png"), panAfterBuffer);

    const report = {
      app: path.relative(root, appPath).split(path.sep).join("/"),
      statuses: {
        before,
        after_start: afterStart,
        after_stop: afterStop,
        after_pan: afterPan,
        after_editor_space: afterEditorSpace,
      },
      code_panel_opened: codePanelOpen,
      editor_focused: editorFocused,
      pan_changed_pixels: panChanged,
      runtimeExceptions: client.exceptions,
    };
    report.checks = {
      space_starts_simulation: before === "idle" && afterStart === "running",
      space_opens_code_panel: codePanelOpen === true,
      space_stops_simulation: afterStop === "stopped",
      pan_keeps_simulation_idle: afterPan === "stopped",
      pan_moves_the_canvas: panChanged >= 200,
      editor_space_keeps_simulation_idle: afterEditorSpace === "stopped",
      no_runtime_exceptions: client.exceptions.length === 0,
    };
    report.pass = Object.values(report.checks).every((value) => value === true);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`status_before=${before}`);
    console.log(`status_after_start=${afterStart} code_panel=${Number(codePanelOpen)}`);
    console.log(`status_after_stop=${afterStop}`);
    console.log(`status_after_pan=${afterPan} pan_changed_pixels=${panChanged}`);
    console.log(`status_after_editor_space=${afterEditorSpace} editor_focused=${Number(editorFocused)}`);
    console.log(`runtime_exceptions=${client.exceptions.length}`);
    for (const [name, value] of Object.entries(report.checks)) {
      console.log(`${name}=${Number(value)}`);
    }
    console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
    console.log(report.pass ? "SPACE SIMULATION CHECK: PASS" : "SPACE SIMULATION CHECK: FAIL");
    if (!report.pass) process.exitCode = 1;
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

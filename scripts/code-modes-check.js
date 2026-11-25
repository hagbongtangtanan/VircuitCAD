"use strict";

/**
 * Checks the code window of a running app build:
 *
 *  - the mode switcher only offers the text sketch,
 *  - the sketch editor and the build output are still there.
 *
 * Usage:
 *   node scripts/code-modes-check.js [--app out/app-code-modes.asar]
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

async function main() {
  const port = Number(arg("port", "9393"));
  const appPath = resolveInput(arg("app", "out/app-code-modes.asar"));
  const reportPath = resolveInput(arg("report", "reports/code-modes-check.json"));

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-code-modes-check-"));
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

    const opened = await evaluate(`(() => {
      const button = document.querySelector('[data-testid="code-toggle"]');
      if (button === null) return false;
      button.click();
      return true;
    })()`);
    await sleep(1200);

    const panel = JSON.parse(
      await evaluate(`(() => {
        const panel = document.querySelector('[data-testid="code-panel"]');
        if (panel === null) return JSON.stringify({ found: false });
        const segments = [...panel.querySelectorAll(".cb-segment")].map((button) => button.textContent.trim());
        return JSON.stringify({
          found: true,
          segments,
          testIds: [...panel.querySelectorAll("[data-testid]")].map((element) => element.getAttribute("data-testid")),
          hasEditor: panel.querySelector('[data-testid="sketch-editor"]') !== null,
          bodyText: panel.innerText.replace(/\\s+/g, " ").slice(0, 160),
        });
      })()`),
    );

    const checks = {
      code_panel_opened: opened === true && panel.found === true,
      only_text_mode: panel.segments.length === 1 && panel.segments[0] === "Text",
      blocks_mode_gone: !panel.segments.some((label) => label.includes("Blocks")),
      block_placeholder_gone: !(panel.testIds || []).some((id) => id.includes("blocks")),
      sketch_editor_present: panel.hasEditor === true,
      no_runtime_exceptions: client.exceptions.length === 0,
    };

    const report = {
      app: path.relative(root, appPath).split(path.sep).join("/"),
      panel,
      checks,
      runtimeExceptions: client.exceptions,
    };
    report.pass = Object.values(report.checks).every((value) => value === true);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`segments=${(panel.segments || []).join("|")}`);
    console.log(`panel_test_ids=${(panel.testIds || []).join(",")}`);
    for (const [name, value] of Object.entries(checks)) {
      console.log(`${name}=${Number(value)}`);
    }
    console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
    console.log(report.pass ? "CODE MODES CHECK: PASS" : "CODE MODES CHECK: FAIL");
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

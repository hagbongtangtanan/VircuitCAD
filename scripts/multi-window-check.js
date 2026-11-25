"use strict";

/**
 * Checks that a project opened from the file manager gets its own window.
 *
 * The app keeps a single instance lock, so the second process hands the file
 * to the running app. The running app must open the file in a new window and
 * leave the project in the first window alone.
 *
 * Usage:
 *   node scripts/multi-window-check.js [--app out/app-multi-window.asar]
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

async function findPages(port) {
  const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  return pages.filter((entry) => entry.type === "page");
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
  const port = Number(arg("port", "9377"));
  const appPath = resolveInput(arg("app", "out/app-multi-window.asar"));
  const reportPath = resolveInput(arg("report", "reports/multi-window-check.json"));

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-multi-window-check-"));
  const projectPath = path.join(userDataDir, "opened-project.vcc");
  fs.copyFileSync(path.join(root, "resources", "samples", "traffic-light.vcc"), projectPath);

  const child = spawn(
    electronBinary,
    [appPath, `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, "--no-sandbox"],
    { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  let client = null;
  try {
    let pages = [];
    for (let attempt = 0; attempt < 150; attempt += 1) {
      try {
        pages = await findPages(port);
        if (pages.length > 0) break;
      } catch {
      }
      await sleep(200);
    }
    if (pages.length === 0) throw new Error("no renderer page appeared");
    client = await connect(pages[0].webSocketDebuggerUrl);
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

    const before = {
      pages: pages.length,
      opened_toast: await evaluate(
        `document.body.innerText.includes("Project opened")`,
      ),
      zoom: await evaluate(
        `(() => { const element = document.querySelector('[data-testid="zoom-level"]'); return element === null ? null : element.textContent.trim(); })()`,
      ),
    };

    const second = spawn(
      electronBinary,
      [appPath, projectPath, `--user-data-dir=${userDataDir}`, "--no-sandbox"],
      { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
    );
    second.stdout.on("data", () => {});
    second.stderr.on("data", () => {});
    const secondExit = await new Promise((resolve) => {
      second.on("exit", (code) => resolve(code));
      setTimeout(() => resolve(null), 15000);
    });

    let afterPages = [];
    for (let attempt = 0; attempt < 60; attempt += 1) {
      afterPages = await findPages(port);
      if (afterPages.length > 1) break;
      await sleep(250);
    }

    const windowStates = [];
    for (const page of afterPages) {
      const pageClient = await connect(page.webSocketDebuggerUrl);
      await pageClient.send("Runtime.enable");
      const evaluatePage = async (expression) => {
        const response = await pageClient.send("Runtime.evaluate", {
          expression,
          returnByValue: true,
          awaitPromise: true,
        });
        if (response.result?.exceptionDetails) {
          throw new Error(String(response.result.exceptionDetails.text).slice(0, 300));
        }
        return response.result?.result?.value;
      };
      await sleep(800);
      windowStates.push({
        id: page.id,
        opened_toast: await evaluatePage(`document.body.innerText.includes("Project opened")`),
        zoom: await evaluatePage(
          `(() => { const element = document.querySelector('[data-testid="zoom-level"]'); return element === null ? null : element.textContent.trim(); })()`,
        ),
        hasCanvas: await evaluatePage(
          `document.querySelector('[data-testid="circuit-canvas"]') !== null`,
        ),
      });
      pageClient.close();
    }

    const openedWindows = windowStates.filter((state) => state.opened_toast === true);
    const checks = {
      started_one_window: before.pages === 1,
      first_window_untouched: before.opened_toast === false,
      second_instance_exited: secondExit !== null,
      second_window_created: afterPages.length === 2,
      file_opened_in_new_window: openedWindows.length === 1,
      first_window_kept_its_project:
        windowStates.filter((state) => state.opened_toast === false).length === 1,
      both_windows_ready: windowStates.every((state) => state.hasCanvas === true),
      no_runtime_exceptions: client.exceptions.length === 0,
    };

    const report = {
      app: path.relative(root, appPath).split(path.sep).join("/"),
      project: projectPath,
      second_instance_exit: secondExit,
      before,
      windows: windowStates,
      checks,
      runtimeExceptions: client.exceptions,
    };
    report.pass = Object.values(report.checks).every((value) => value === true);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`pages_before=${before.pages}`);
    console.log(`pages_after=${afterPages.length}`);
    console.log(`second_instance_exit=${secondExit}`);
    for (const state of windowStates) {
      console.log(`window=${state.id.slice(0, 8)} opened=${Number(state.opened_toast)} zoom=${state.zoom}`);
    }
    for (const [name, value] of Object.entries(checks)) {
      console.log(`${name}=${Number(value)}`);
    }
    console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
    console.log(report.pass ? "MULTI WINDOW CHECK: PASS" : "MULTI WINDOW CHECK: FAIL");
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

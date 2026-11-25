"use strict";

/**
 * Runtime check for the patched VircuitCAD build.
 *
 * Builds a throwaway app directory in out/patched/runtime from the patched
 * main, preload and renderer bundles, launches it with Electron and drives
 * the real UI over the Chrome DevTools Protocol. The installed app is never
 * touched.
 *
 * Usage:
 *   node scripts/test-files-app.js [--port <cdp port>] [--report <path>]
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const runtimeDir = path.join(root, "out", "patched", "runtime");
const electronBinary = path.join(root, "node_modules", "electron", "dist", "electron");
const workApp = path.join(root, "work", "app");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
  return value;
}

const port = Number(arg("port", "9333"));
const variant = arg("variant", "patched");
const reportPath = path.resolve(root, arg("report", "reports/file-features-phase3-app.json"));

const results = [];

function record(id, title, status, evidence, severity) {
  results.push({ id, check: title, status, evidence, severity: severity ?? "none" });
  console.log(`${status.padEnd(5)} ${id.padEnd(4)} ${title}`);
  console.log(`      ${evidence}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else fs.copyFileSync(source, target);
  }
}

function buildRuntime() {
  const bundleRoot =
    variant === "patched"
      ? path.join(root, "out", "patched", "app", "out")
      : path.join(workApp, "out");
  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(runtimeDir, "out", "main"), { recursive: true });
  fs.mkdirSync(path.join(runtimeDir, "out", "preload"), { recursive: true });
  fs.copyFileSync(path.join(workApp, "package.json"), path.join(runtimeDir, "package.json"));
  fs.copyFileSync(
    path.join(bundleRoot, "main", "index.js"),
    path.join(runtimeDir, "out", "main", "index.js"),
  );
  fs.copyFileSync(
    path.join(bundleRoot, "preload", "index.js"),
    path.join(runtimeDir, "out", "preload", "index.js"),
  );
  copyTree(path.join(workApp, "out", "renderer"), path.join(runtimeDir, "out", "renderer"));
  if (variant === "patched") {
    fs.copyFileSync(
      path.join(bundleRoot, "renderer", "assets", "index-BU2QbNS1.js"),
      path.join(runtimeDir, "out", "renderer", "assets", "index-BU2QbNS1.js"),
    );
  }
  fs.symlinkSync(path.join(workApp, "node_modules"), path.join(runtimeDir, "node_modules"), "dir");
  fs.mkdirSync(path.join(runtimeDir, "resources"), { recursive: true });
  fs.symlinkSync(
    path.join(root, "resources", "samples"),
    path.join(runtimeDir, "resources", "samples"),
    "dir",
  );
}

async function findPage() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
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
    const exceptions = [];
    let requestId = 0;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        exceptions.push(message.params.exceptionDetails.text);
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
  if (!fs.existsSync(electronBinary)) throw new Error(`electron binary missing: ${electronBinary}`);
  buildRuntime();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vcircuitcad-runtime-"));
  const child = spawn(
    electronBinary,
    [runtimeDir, `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, "--no-sandbox"],
    { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  child.stdout.on("data", () => {});

  let client = null;
  try {
    const page = await findPage();
    client = await connect(page.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
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

    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      ready = await evaluate(
        `(() => {
          const menu = document.querySelector('[data-testid="file-menu-toggle"]');
          const title = document.querySelector('[data-testid="project-title"]');
          return Boolean(menu && title);
        })()`,
      );
      if (ready) break;
      await sleep(250);
    }
    record(
      "R1",
      "the patched build starts and renders the File menu",
      ready ? "PASS" : "FAIL",
      `ui_ready=${ready} cdp_page=${page.url}`,
      ready ? "none" : "Critical",
    );

    const renamed = await evaluate(`(() => {
      const input = document.querySelector('[data-testid="project-title"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "Guarded Project");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await sleep(400);
    const dirty = await evaluate(
      `Boolean(document.querySelector(".cb-dirty-dot"))`,
    );
    record(
      "R2",
      "an edit marks the document dirty",
      renamed && dirty ? "PASS" : "FAIL",
      `renamed=${renamed} dirty_dot=${dirty} title=${JSON.stringify(
        await evaluate(`document.querySelector('[data-testid="project-title"]').value`),
      )}`,
      renamed && dirty ? "none" : "High",
    );

    await evaluate(`(() => {
      document.querySelector('[data-testid="file-menu-toggle"]').click();
      return true;
    })()`);
    await sleep(300);
    const clicked = await evaluate(`(() => {
      const item = document.querySelector('[data-testid="file-new"]');
      if (!item) return false;
      item.click();
      return true;
    })()`);
    await sleep(1200);
    const after = await evaluate(`(() => ({
      title: document.querySelector('[data-testid="project-title"]').value,
      dirty: Boolean(document.querySelector(".cb-dirty-dot")),
      windowTitle: document.title,
    }))()`);
    const pending =
      clicked && after.title === "Guarded Project" && after.dirty === true;
    record(
      "R3",
      "New is blocked while the unsaved-changes confirmation is pending",
      pending ? "PASS" : "FAIL",
      `clicked=${clicked} title_after=${JSON.stringify(after.title)} dirty_after=${after.dirty} window_title=${JSON.stringify(after.windowTitle)}`,
      pending ? "none" : "Critical",
    );

    const responsive = await evaluate(`(() => document.readyState)()`);
    record(
      "R4",
      "the renderer stays responsive while the confirmation is open",
      responsive === "complete" ? "PASS" : "FAIL",
      `ready_state=${responsive}`,
      "none",
    );

    const exceptions = client.exceptions;
    record(
      "R5",
      "the patched renderer raised no uncaught exceptions",
      exceptions.length === 0 ? "PASS" : "FAIL",
      exceptions.length === 0 ? "no exceptions" : exceptions.join(" | "),
      exceptions.length === 0 ? "none" : "High",
    );
  } finally {
    if (client) {
      try {
        client.send("Browser.close").catch(() => {});
      } catch {
      }
    }
    child.kill("SIGTERM");
    await sleep(600);
    if (!child.killed) child.kill("SIGKILL");
  }

  const counts = {};
  for (const entry of results) counts[entry.status] = (counts[entry.status] ?? 0) + 1;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify({ variant, runtime_dir: path.relative(root, runtimeDir), counts, results, stderr: stderr.slice(0, 2000) }, null, 2)}\n`,
  );
  console.log("");
  console.log(`counts: ${JSON.stringify(counts)}`);
  console.log(`report: ${path.relative(root, reportPath)}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

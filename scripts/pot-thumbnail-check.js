"use strict";

/**
 * Checks the parts panel thumbnail of the potentiometer in a running app
 * build: the library now shows the very drawing the canvas draws, so the
 * thumbnail has to be the round knob body of the shared module and not the
 * old side view.
 *
 * Usage:
 *   node scripts/pot-thumbnail-check.js [--app out/app-pot.asar] [--port <cdp port>]
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

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
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
  const spec = await import(path.join(root, "pot-new", "src", "potSpec.ts"));
  const port = Number(arg("port", "9344"));
  const appPath = resolveInput(arg("app", "out/app-pot.asar"));
  const reportPath = resolveInput(arg("report", "reports/pot-thumbnail-check.json"));
  const outDir = resolveInput(arg("out", "pot-new/out"));

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-pot-thumb-"));
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

    await sleep(3000);
    await evaluate(
      `(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.innerText.includes("already know")); if (button) button.click(); return true; })()`,
    );
    await sleep(900);

    const found = await evaluate(`(() => {
      const label = [...document.querySelectorAll(".cb-part-card-label")].find((entry) => entry.textContent.trim() === "Potentiometer");
      if (!label) return false;
      const element = label.closest(".cb-part-card");
      if (!element) return false;
      element.scrollIntoView({ block: "center" });
      return true;
    })()`);
    if (!found) throw new Error("the potentiometer part card was not found");
    await sleep(900);

    const card = JSON.parse(
      await evaluate(`(() => {
        const label = [...document.querySelectorAll(".cb-part-card-label")].find((entry) => entry.textContent.trim() === "Potentiometer");
        const element = label.closest(".cb-part-card");
        const rect = element.getBoundingClientRect();
        return JSON.stringify({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      })()`),
    );

    const shot = await client.send("Page.captureScreenshot", { format: "png" });
    if (!shot.result?.data) throw new Error("screenshot failed");
    const screenshotBuffer = Buffer.from(shot.result.data, "base64");
    fs.mkdirSync(outDir, { recursive: true });
    const screenshotPath = path.join(outDir, "app-parts-panel.png");
    fs.writeFileSync(screenshotPath, screenshotBuffer);

    const imageInfo = await sharp(screenshotBuffer).metadata();
    const left = Math.max(0, Math.floor(card.x));
    const top = Math.max(0, Math.floor(card.y));
    const width = Math.min(Math.ceil(card.width), imageInfo.width - left);
    const height = Math.min(Math.ceil(card.height), imageInfo.height - top);
    if (width < 4 || height < 4) {
      throw new Error(`the part card is outside the screenshot: ${JSON.stringify(card)}`);
    }
    const cropBuffer = await sharp(screenshotBuffer)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
    const cropPath = path.join(outDir, "app-pot-thumbnail.png");
    fs.writeFileSync(cropPath, cropBuffer);

    const source = await evaluate(`(() => {
      const label = [...document.querySelectorAll(".cb-part-card-label")].find((entry) => entry.textContent.trim() === "Potentiometer");
      const element = label.closest(".cb-part-card");
      const image = element.querySelector("img.cb-part-art");
      return image === null ? "" : image.getAttribute("src");
    })()`);
    if (!source.startsWith("data:image/png;base64,")) {
      throw new Error("the potentiometer thumbnail is not a canvas rendered png");
    }
    const thumbnailBuffer = Buffer.from(source.split(",")[1], "base64");
    const thumbnailPath = path.join(outDir, "app-pot-thumbnail.png");
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);
    const { data, info } = await sharp(thumbnailBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const counts = new Map();
    let opaque = 0;
    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const index = (y * info.width + x) * info.channels;
        if (data[index + 3] < 32) continue;
        opaque += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        const key = `${data[index]},${data[index + 1]},${data[index + 2]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const countNear = (hex, tolerance = 12) => {
      const [r, g, b] = hexToRgb(hex);
      let total = 0;
      for (const [key, amount] of counts) {
        const [pr, pg, pb] = key.split(",").map(Number);
        if (Math.abs(pr - r) <= tolerance && Math.abs(pg - g) <= tolerance && Math.abs(pb - b) <= tolerance) {
          total += amount;
        }
      }
      return total;
    };

    const light = spec.tokensFor("light");
    const dark = spec.tokensFor("dark");
    const oldBody = countNear("#2c5c8e", 0);
    const rim = Math.max(countNear(light.bodyRim), countNear(dark.bodyRim));
    const body = Math.max(countNear(light.bodyOuter), countNear(dark.bodyOuter));
    const pointer = Math.max(countNear(light.pointer), countNear(dark.pointer));
    const knob = Math.max(countNear(light.knobBottom), countNear(dark.knobBottom));
    const tail = Math.max(countNear(light.tail), countNear(dark.tail));
    const box =
      maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    const shapeRatio = box === null ? null : box.width / box.height;

    const report = {
      app: path.relative(root, appPath).split(path.sep).join("/"),
      card: { x: card.x, y: card.y, width: card.width, height: card.height },
      crop: { left, top, width, height },
      thumbnail: { width: info.width, height: info.height, opaque, box, shapeRatio },
      pixelCounts: { oldBody, rim, body, pointer, knob, tail },
      tokens: {
        bodyRim: light.bodyRim,
        bodyOuter: light.bodyOuter,
        pointer: light.pointer,
        knobBottom: light.knobBottom,
      },
      files: {
        screenshot: path.relative(root, screenshotPath).split(path.sep).join("/"),
        crop: path.relative(root, thumbnailPath).split(path.sep).join("/"),
      },
      runtimeExceptions: client.exceptions,
    };
    report.pass =
      report.runtimeExceptions.length === 0 &&
      info.width === 192 &&
      info.height === 112 &&
      opaque >= 500 &&
      shapeRatio !== null &&
      shapeRatio < 1.35 &&
      oldBody < 60 &&
      rim >= 100 &&
      body >= 500 &&
      pointer >= 200 &&
      knob >= 80 &&
      tail >= 100;

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`app=${report.app}`);
    console.log(`card=${card.x.toFixed(0)},${card.y.toFixed(0)} ${card.width.toFixed(0)}x${card.height.toFixed(0)}`);
    console.log(`thumbnail=${info.width}x${info.height} opaque=${opaque} shape_ratio=${shapeRatio?.toFixed(3)}`);
    console.log(`old_body_pixels=${oldBody}`);
    console.log(`rim_pixels=${rim} body_pixels=${body} pointer_pixels=${pointer} knob_pixels=${knob} tail_pixels=${tail}`);
    console.log(`runtime_exceptions=${report.runtimeExceptions.length}`);
    console.log(`files=${report.files.screenshot} ${report.files.crop}`);
    console.log(`report=${path.relative(root, reportPath)}`);
    console.log(report.pass ? "THUMBNAIL CHECK: PASS" : "THUMBNAIL CHECK: FAIL");
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

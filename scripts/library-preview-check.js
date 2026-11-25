"use strict";

/**
 * Checks the parts library of a running app build:
 *
 *  - every library card shows a PNG rendered by the canvas drawing code,
 *  - dragging a card uses the component artwork as the drag ghost,
 *  - dropping a card puts the real component on the canvas and the canvas
 *    drawing matches the library artwork.
 *
 * Usage:
 *   node scripts/library-preview-check.js [--app out/app-library.asar] [--port <cdp port>]
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const electronBinary = path.join(root, "node_modules", "electron", "dist", "electron");
const MIME = "application/x-vcircuitcad-part";

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

function countNear(counts, hex, tolerance = 12) {
  const value = hex.replace("#", "");
  const [r, g, b] = [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
  let total = 0;
  for (const [key, amount] of counts) {
    const [pr, pg, pb] = key.split(",").map(Number);
    if (Math.abs(pr - r) <= tolerance && Math.abs(pg - g) <= tolerance && Math.abs(pb - b) <= tolerance) {
      total += amount;
    }
  }
  return total;
}

function dominantColors(data, info, limit = 8) {
  const counts = new Map();
  for (let index = 0; index < data.length; index += info.channels) {
    if (info.channels === 4 && data[index + 3] < 32) continue;
    const key = `${data[index]},${data[index + 1]},${data[index + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, amount]) => ({ rgb: key.split(",").map(Number), amount }));
}

async function analysePng(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
    }
  }
  return {
    width: info.width,
    height: info.height,
    opaque,
    box:
      maxX < 0
        ? null
        : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    colors: dominantColors(data, info),
  };
}

async function main() {
  const port = Number(arg("port", "9355"));
  const appPath = resolveInput(arg("app", "out/app-library.asar"));
  const reportPath = resolveInput(arg("report", "reports/library-preview-check.json"));
  const outDir = resolveInput(arg("out", "out/library-preview"));

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-library-check-"));
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
    await sleep(800);

    await evaluate(`(() => {
      const select = document.querySelector('[data-testid="parts-section"]');
      if (!select) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(select, "all");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await sleep(2500);

    const cards = JSON.parse(
      await evaluate(`(() => {
        const list = [...document.querySelectorAll(".cb-part-card")].map((card) => {
          const image = card.querySelector("img.cb-part-art");
          return {
            type: card.getAttribute("data-part-type"),
            hasImage: image !== null,
            width: image === null ? 0 : image.naturalWidth,
            height: image === null ? 0 : image.naturalHeight,
            bytes: image === null ? 0 : (image.getAttribute("src") || "").length,
            isPng: image === null ? false : (image.getAttribute("src") || "").startsWith("data:image/png;base64,"),
          };
        });
        return JSON.stringify(list);
      })()`),
    );

    const thumbnails = {};
    for (const card of cards) {
      const source = await evaluate(`(() => {
        const card = document.querySelector('[data-part-type="${card.type}"]');
        const image = card === null ? null : card.querySelector("img.cb-part-art");
        return image === null ? "" : image.getAttribute("src");
      })()`);
      if (!source) {
        thumbnails[card.type] = null;
        continue;
      }
      const buffer = Buffer.from(source.split(",")[1], "base64");
      thumbnails[card.type] = { ...(await analysePng(buffer)), bytes: buffer.length };
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, `thumb-${card.type}.png`), buffer);
    }

    const dragSpy = await evaluate(`(() => {
      window.__VC_DRAG_SPY__ = [];
      const original = DataTransfer.prototype.setDragImage;
      if (!DataTransfer.prototype.__vcPatched) {
        DataTransfer.prototype.setDragImage = function (image, x, y) {
          window.__VC_DRAG_SPY__.push({
            tagName: image === null || image === undefined ? null : image.tagName,
            isImage: image instanceof HTMLImageElement,
            src: image && image.getAttribute ? (image.getAttribute("src") || "").slice(0, 24) : null,
            offsetX: x,
            offsetY: y,
          });
          return original.call(this, image, x, y);
        };
        DataTransfer.prototype.__vcPatched = true;
      }
      const card = document.querySelector('[data-part-type="potentiometer"]');
      if (card === null) return JSON.stringify({ started: false, calls: [] });
      const transfer = new DataTransfer();
      card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      return JSON.stringify({
        started: true,
        calls: window.__VC_DRAG_SPY__,
      });
    })()`);
    const drag = JSON.parse(dragSpy);

    const dropTypes = ["potentiometer", "led"];
    const drops = [];
    for (const type of dropTypes) {
      const before = await client.send("Page.captureScreenshot", { format: "png" });
      const beforeBuffer = Buffer.from(before.result.data, "base64");

      const boxes = JSON.parse(
        await evaluate(`(() => {
          const card = document.querySelector('[data-part-type="${type}"]');
          if (card === null) return JSON.stringify({ ok: false });
          card.scrollIntoView({ block: "center" });
          const cardRect = card.getBoundingClientRect();
          const canvas = document.querySelector('[data-testid="circuit-canvas"]');
          const canvasRect = canvas.getBoundingClientRect();
          return JSON.stringify({
            ok: true,
            card: { x: cardRect.x + cardRect.width / 2, y: cardRect.y + cardRect.height / 2 },
            target: {
              x: canvasRect.left + canvasRect.width * 0.5,
              y: canvasRect.top + canvasRect.height * 0.45,
            },
          });
        })()`),
      );
      if (!boxes.ok) throw new Error(`the ${type} card was not found`);
      await sleep(400);

      await client.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: boxes.card.x,
        y: boxes.card.y,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      for (let step = 1; step <= 12; step += 1) {
        await client.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: boxes.card.x + ((boxes.target.x - boxes.card.x) * step) / 12,
          y: boxes.card.y + ((boxes.target.y - boxes.card.y) * step) / 12,
          button: "left",
          buttons: 1,
        });
        await sleep(60);
      }
      await client.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: boxes.target.x,
        y: boxes.target.y,
        button: "left",
        buttons: 0,
        clickCount: 1,
      });
      await sleep(900);

      const inspector = await evaluate(
        `(() => { const title = document.querySelector(".cb-inspector-title"); return title === null ? null : title.textContent.trim(); })()`,
      );

      const after = await client.send("Page.captureScreenshot", { format: "png" });
      const afterBuffer = Buffer.from(after.result.data, "base64");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, `canvas-${type}.png`), afterBuffer);

      const crop = {
        left: Math.max(0, Math.round(boxes.target.x - 110)),
        top: Math.max(0, Math.round(boxes.target.y - 130)),
        width: 220,
        height: 260,
      };
      const imageInfo = await sharp(afterBuffer).metadata();
      crop.width = Math.min(crop.width, imageInfo.width - crop.left);
      crop.height = Math.min(crop.height, imageInfo.height - crop.top);
      const afterCrop = await sharp(afterBuffer)
        .extract(crop)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const beforeCrop = await sharp(beforeBuffer)
        .extract(crop)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let changed = 0;
      for (let index = 0; index < afterCrop.data.length; index += afterCrop.info.channels) {
        const beforeIndex = index;
        if (
          afterCrop.data[index] !== beforeCrop.data[beforeIndex] ||
          afterCrop.data[index + 1] !== beforeCrop.data[beforeIndex + 1] ||
          afterCrop.data[index + 2] !== beforeCrop.data[beforeIndex + 2]
        ) {
          changed += 1;
        }
      }

      const counts = new Map();
      for (let index = 0; index < afterCrop.data.length; index += afterCrop.info.channels) {
        const key = `${afterCrop.data[index]},${afterCrop.data[index + 1]},${afterCrop.data[index + 2]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      const thumb = thumbnails[type];
      const matched = [];
      for (const color of thumb === null || thumb === undefined ? [] : thumb.colors) {
        const [r, g, b] = color.rgb;
        const amount = countNear(counts, `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`);
        if (amount >= 3) matched.push({ rgb: color.rgb, amount });
      }

      drops.push({ type, target: boxes.target, inspector, crop, changed_pixels: changed, matched_colors: matched });
    }

    const allCardsRendered =
      cards.length === 12 &&
      cards.every(
        (card) =>
          card.hasImage === true &&
          card.isPng === true &&
          card.width === 192 &&
          card.height === 112 &&
          (thumbnails[card.type]?.opaque ?? 0) >= 40,
      );
    const potThumb = thumbnails["potentiometer"];
    const potIsRound =
      potThumb !== null &&
      potThumb !== undefined &&
      potThumb.box !== null &&
      potThumb.box.width / potThumb.box.height < 1.35;
    const dragUsesArtwork =
      drag.calls.length === 1 &&
      drag.calls[0].isImage === true &&
      String(drag.calls[0].src).startsWith("data:image/png;base64,") &&
      drag.calls[0].offsetX > 0 &&
      drag.calls[0].offsetY > 0;
    const dropsMatch =
      drops.length === 2 &&
      drops.every(
        (entry) =>
          entry.changed_pixels >= 200 &&
          entry.matched_colors.length >= 3 &&
          entry.inspector !== null,
      );

    const report = {
      app: path.relative(root, appPath).split(path.sep).join("/"),
      cards,
      thumbnails,
      drag,
      drops,
      checks: {
        all_cards_rendered: allCardsRendered,
        potentiometer_thumbnail_is_round: potIsRound,
        drag_uses_component_artwork: dragUsesArtwork,
        drops_match_canvas_artwork: dropsMatch,
        no_runtime_exceptions: client.exceptions.length === 0,
      },
      runtimeExceptions: client.exceptions,
    };
    report.pass = Object.values(report.checks).every((value) => value === true);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`cards=${cards.length}`);
    console.log(`cards_rendered=${cards.filter((card) => card.hasImage).length}`);
    console.log(`drag_calls=${drag.calls.length}`);
    for (const entry of drops) {
      console.log(
        `drop_${entry.type}=changed:${entry.changed_pixels} matched_colors:${entry.matched_colors.length}`,
      );
    }
    console.log(`runtime_exceptions=${client.exceptions.length}`);
    for (const [name, value] of Object.entries(report.checks)) {
      console.log(`${name}=${Number(value)}`);
    }
    console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
    console.log(report.pass ? "LIBRARY PREVIEW CHECK: PASS" : "LIBRARY PREVIEW CHECK: FAIL");
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

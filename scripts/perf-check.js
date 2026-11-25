"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
  return value;
}

const label = arg("label", "current");
const sampleName = arg("sample", "traffic-light.vcc");
const durationMs = Number(arg("duration", "6000"));
const settleMs = Number(arg("settle", "1200"));
const port = arg("port", "9222");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let socket = null;

async function main() {
  const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  const page = pages.find((entry) => entry.type === "page");
  if (!page) throw new Error("Electron renderer page not found");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  socket = ws;
  let requestId = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails.text);
    }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++requestId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.result?.exceptionDetails) {
      throw new Error(response.result.exceptionDetails.text);
    }
    return response.result?.result?.value;
  }
  async function clickButton(match) {
    return evaluate(
      `(() => { const button = [...document.querySelectorAll('button')].find((entry) => ${match}); if (!button) return false; button.click(); return true; })()`,
    );
  }

  await send("Runtime.enable");
  await send("Page.enable");

  await evaluate(`(() => {
    const state = { domParser: 0, ctxOps: 0, longTasks: 0, frames: [] };
    window.__PERF__ = state;
    const parser = DOMParser.prototype.parseFromString;
    DOMParser.prototype.parseFromString = function (...args) {
      state.domParser += 1;
      return parser.apply(this, args);
    };
    const context = CanvasRenderingContext2D.prototype;
    const counted = [
      "fill", "stroke", "fillRect", "strokeRect", "drawImage", "clearRect",
      "fillText", "strokeText", "putImageData", "arc", "beginPath", "closePath",
      "moveTo", "lineTo", "stroke", "fill", "createRadialGradient", "createLinearGradient",
      "save", "restore", "translate", "rotate", "scale", "setTransform", "clip", "rect",
    ];
    for (const name of counted) {
      const original = context[name];
      if (typeof original !== "function") continue;
      context[name] = function (...args) {
        state.ctxOps += 1;
        return original.apply(this, args);
      };
    }
    let last = 0;
    const tick = (now) => {
      if (last > 0) state.frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      const observer = new PerformanceObserver((list) => {
        state.longTasks += list.getEntries().length;
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
    }
    return true;
  })()`);

  await clickButton(`entry.innerText === 'Samples'`);
  await wait(400);
  const opened = await clickButton(`entry.innerText.includes('${sampleName}')`);
  if (!opened) throw new Error(`sample not found: ${sampleName}`);
  await wait(900);
  await evaluate(`window.__LCD_DAMAGE_ENGINE__?.repairAll?.();`);
  const started = await clickButton(`entry.dataset.testid === 'sim-button'`);
  if (!started) throw new Error("simulation button not found");
  await wait(settleMs);
  await evaluate(`(() => { const state = window.__PERF__; state.domParser = 0; state.ctxOps = 0; state.longTasks = 0; state.frames.length = 0; return true; })()`);
  await wait(durationMs);
  const metrics = await evaluate(`(() => {
    const state = window.__PERF__;
    const frames = state.frames.slice().sort((a, b) => a - b);
    const pick = (ratio) => frames.length ? frames[Math.min(frames.length - 1, Math.floor(frames.length * ratio))] : 0;
    const sum = frames.reduce((total, value) => total + value, 0);
    return {
      domParser: state.domParser,
      ctxOps: state.ctxOps,
      longTasks: state.longTasks,
      frameCount: frames.length,
      frameP50: pick(0.5),
      frameP95: pick(0.95),
      frameMax: frames.length ? frames[frames.length - 1] : 0,
      frameMean: frames.length ? sum / frames.length : 0,
      over16: frames.filter((value) => value > 16.7).length,
      over33: frames.filter((value) => value > 33.3).length,
    };
  })()`);

  const report = {
    label,
    sample: sampleName,
    port,
    durationMs,
    settleMs,
    metrics,
    runtimeExceptions: exceptions,
  };
  const reportPath = path.join(root, "reports", `perf-${label}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`label=${label} sample=${sampleName}`);
  console.log(
    `frames=${metrics.frameCount} p50=${metrics.frameP50.toFixed(2)} p95=${metrics.frameP95.toFixed(2)} max=${metrics.frameMax.toFixed(2)} over16=${metrics.over16}`,
  );
  console.log(`domParser=${metrics.domParser} ctxOps=${metrics.ctxOps} longTasks=${metrics.longTasks}`);
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  ws.close();
}

main()
  .catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  })
  .finally(() => {
    socket?.close();
  });

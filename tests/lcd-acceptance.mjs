import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || "/tmp/opencode/lcd-acceptance";
const baseline = JSON.parse(fs.readFileSync(path.join(here, "lcd-pin-before.json"), "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
const target = targets.find((item) => item.type === "page" && item.url.startsWith("file:"));
if (target === void 0) throw new Error(`No renderer page on debug port ${port}`);

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown")
    consoleErrors.push(message.params.exceptionDetails?.text ?? "exception");
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
    consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  if (message.id !== void 0 && pending.has(message.id)) {
    pending.get(message.id)(message.result);
    pending.delete(message.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const requestId = ++id;
    pending.set(requestId, resolve);
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails !== void 0)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
await new Promise((resolve) => (ws.onopen = resolve));
await send("Runtime.enable");
await send("Page.enable");
await evaluate(
  "(()=>{const button=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close')||[...document.querySelectorAll('.cb-tour-card button')].find((item)=>/already know/i.test(item.textContent||''));button?.click();return Boolean(button);})()",
);
await wait(300);

const setup = async (props = {}) => {
  const ids = await evaluate(
    `window.__LCD_TEST_SETUP__(${JSON.stringify({ props })}); true`,
  );
  await evaluate("window.__LCD_VIEWPORT_STORE__.getState().setViewport({ scale: 1, offsetX: 80, offsetY: 40 }); true");
  await wait(350);
  void ids;
  return evaluate("(()=>{const d=window.__LCD_STORE__.getState().document;return {parallelId:d.parts.find(p=>p.type==='lcd-16x2').id,i2cId:d.parts.find(p=>p.type==='lcd-16x2-i2c').id};})()");
};
const pinDebug = async () => evaluate("JSON.parse(JSON.stringify(window.__LCD_PIN_DEBUG__()))");
const renderMetrics = async () => evaluate("JSON.parse(JSON.stringify(window.__LCD_RENDER_METRICS__ ?? {}))");
const screenshot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(outDir, name);
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  return file;
};
const dispatchMouse = (type, point, buttons = 0) =>
  send("Input.dispatchMouseEvent", {
    type,
    x: point.x,
    y: point.y,
    button: type === "mouseReleased" || buttons > 0 ? "left" : "none",
    buttons,
    clickCount: 1,
  });
const viewport = async () => evaluate("({...window.__LCD_VIEWPORT_STORE__.getState().viewport, ...document.querySelector('[data-testid=\"circuit-canvas\"]').getBoundingClientRect().toJSON()})");
const toPage = (world, view) => ({
  x: view.left + view.offsetX + world.x * view.scale,
  y: view.top + view.offsetY + world.y * view.scale,
});
const clickWorld = async (world) => {
  const point = toPage(world, await viewport());
  await dispatchMouse("mouseMoved", point);
  await dispatchMouse("mousePressed", point, 1);
  await dispatchMouse("mouseReleased", point, 0);
  await wait(150);
};
const dragWorld = async (from, to, view) => {
  const fromPage = toPage(from, view);
  const toPagePoint = toPage(to, view);
  await dispatchMouse("mouseMoved", fromPage);
  await dispatchMouse("mousePressed", fromPage, 1);
  for (let step = 1; step <= 6; step += 1) {
    const ratio = step / 6;
    await dispatchMouse(
      "mouseMoved",
      {
        x: fromPage.x + (toPagePoint.x - fromPage.x) * ratio,
        y: fromPage.y + (toPagePoint.y - fromPage.y) * ratio,
      },
      1,
    );
  }
  await dispatchMouse("mouseReleased", toPagePoint, 0);
  await wait(250);
};

function comparePins(before, after) {
  const rows = [];
  let maxDifference = 0;
  for (const beforePart of before) {
    const afterPart = after.find(
      (candidate) => candidate.type === beforePart.type,
    );
    for (const beforePin of beforePart.pins) {
      const afterPin = afterPart.pins.find(
        (candidate) => candidate.pinId === beforePin.pinId,
      );
      const dx = afterPin.x - beforePin.x;
      const dy = afterPin.y - beforePin.y;
      const difference = Math.hypot(dx, dy);
      maxDifference = Math.max(maxDifference, difference);
      rows.push({
        type: beforePart.type,
        pinId: beforePin.pinId,
        before: { x: beforePin.x, y: beforePin.y },
        after: { x: afterPin.x, y: afterPin.y },
        dx,
        dy,
        difference,
      });
    }
  }
  return { rows, maxDifference, pass: maxDifference === 0 };
}

async function pinSafety() {
  await setup();
  const after = await pinDebug();
  return comparePins(baseline, after);
}

async function renderStates() {
  const ids = await setup();
  await evaluate("window.__LCD_SIM_STORE__.setState({status:'stopped',lcdDisplays:{}}); true");
  await wait(250);
  const configs = [
    { name: "blue", props: { theme: "blue", backlight: true, contrast: 0.85, lines: ["Hello World!", "LCD Tutorial"] } },
    { name: "green", props: { theme: "green", backlight: true, contrast: 0.85, lines: ["Hello World!", "LCD Tutorial"] } },
    { name: "backlight-off", props: { theme: "blue", backlight: false, contrast: 0.85, lines: ["Hello World!", "LCD Tutorial"] } },
    { name: "low-contrast", props: { theme: "blue", backlight: true, contrast: 0.08, lines: ["Hello World!", "LCD Tutorial"] } },
  ];
  const results = [];
  for (const config of configs) {
    await evaluate(`window.__LCD_TEST_SET_PROPS__(${JSON.stringify(config.props)}); true`);
    await wait(350);
    const allMetrics = await renderMetrics();
    const parallel = allMetrics[ids.parallelId];
    const i2c = allMetrics[ids.i2cId];
    const file = await screenshot(`state-${config.name}.png`);
    const expectedBacklight = false;
    results.push({
      name: config.name,
      expectedBacklight,
      parallel,
      i2c,
      screenshot: file,
      distinct:
        parallel.theme === config.props.theme &&
        parallel.backlight === expectedBacklight &&
        parallel.contrast === config.props.contrast &&
        i2c.theme === config.props.theme &&
        i2c.backlight === expectedBacklight &&
        i2c.contrast === config.props.contrast,
    });
  }
  await setup();
  const defaultScreenshot = await screenshot("default-both-variants.png");
  return { states: results, defaultScreenshot, pass: results.every((item) => item.distinct) };
}

async function wiring() {
  const ids = await setup();
  const pins = await pinDebug();
  const parallel = pins.find((part) => part.type === "lcd-16x2");
  const i2c = pins.find((part) => part.type === "lcd-16x2-i2c");
  const pick = (part, pinId) => part.pins.find((pin) => pin.pinId === pinId);
  const pairs = [
    [pick(parallel, "vdd"), pick(i2c, "vcc")],
    [pick(parallel, "vss"), pick(i2c, "gnd")],
  ];
  for (const [from, to] of pairs) {
    await clickWorld({ x: from.x, y: from.y });
    await clickWorld({ x: to.x, y: to.y });
  }
  const wires = await evaluate(
    "JSON.parse(JSON.stringify(window.__LCD_STORE__.getState().document.wires))",
  );
  const screenshotFile = await screenshot("wiring.png");
  return {
    pairs: pairs.map(([from, to]) => ({ from: from.pinId, to: to.pinId })),
    wireCount: wires.length,
    wires,
    screenshot: screenshotFile,
    pass: wires.length === 2,
  };
}

async function flip() {
  const ids = await setup();
  const before = await pinDebug();
  const expectedFor = (part, axis) => {
    const size =
      part.type === "lcd-16x2" ? { width: 150, height: 86 } : { width: 120, height: 90 };
    return part.pins.map((pin) => ({
      pinId: pin.pinId,
      x:
        axis === "horizontal"
          ? 2 * part.position.x + size.width - pin.x
          : pin.x,
      y:
        axis === "vertical"
          ? 2 * part.position.y + size.height - pin.y
          : pin.y,
    }));
  };
  const results = [];
  for (const axis of ["horizontal", "vertical"]) {
    for (const part of before) {
      await evaluate(
        `(()=>{const s=window.__LCD_STORE__.getState();s.selectParts(['${part.partId}']);s.flipSelected('${axis}');return true;})()`,
      );
      await wait(250);
      const after = await pinDebug();
      const afterPart = after.find((candidate) => candidate.partId === part.partId);
      const expected = expectedFor(part, axis);
      const differences = expected.map((pin) => {
        const actual = afterPart.pins.find((candidate) => candidate.pinId === pin.pinId);
        return Math.hypot(actual.x - pin.x, actual.y - pin.y);
      });
      results.push({
        type: part.type,
        axis,
        maxDifference: Math.max(...differences),
        pass: differences.every((difference) => difference === 0),
        pins: afterPart.pins,
      });
      await evaluate(
        `(()=>{const s=window.__LCD_STORE__.getState();s.selectParts(['${part.partId}']);s.flipSelected('${axis}');return true;})()`,
      );
      await wait(200);
    }
  }
  await evaluate(
    `(()=>{const s=window.__LCD_STORE__.getState();s.selectParts(['${ids.parallelId}','${ids.i2cId}']);s.flipSelected('horizontal');return true;})()`,
  );
  await wait(300);
  const flippedScreenshot = await screenshot("flip-horizontal-readable.png");
  return {
    results,
    flippedScreenshot,
    pass: results.every((item) => item.pass),
  };
}

async function dragFive() {
  await setup();
  const added = await evaluate(
    "(()=>{const s=window.__LCD_STORE__.getState();return [s.addPart('lcd-16x2',{x:200,y:560}),s.addPart('lcd-16x2-i2c',{x:420,y:560}),s.addPart('lcd-16x2',{x:640,y:560})];})()",
  );
  await evaluate("window.__LCD_VIEWPORT_STORE__.getState().fitToContent(); true");
  await wait(350);
  const view = await viewport();
  const parts = await evaluate(
    "JSON.parse(JSON.stringify(window.__LCD_STORE__.getState().document.parts.filter(p=>p.type.startsWith('lcd-16x2'))))",
  );
  const startedAt = Date.now();
  const results = [];
  for (const part of parts) {
    const size =
      part.type === "lcd-16x2" ? { width: 150, height: 86 } : { width: 120, height: 90 };
    const from = {
      x: part.position.x + size.width - 6,
      y: part.position.y + size.height / 2,
    };
    await dragWorld(from, { x: from.x + 30, y: from.y + 15 }, view);
    const moved = await evaluate(
      `(()=>{const p=window.__LCD_STORE__.getState().document.parts.find(p=>p.id==='${part.id}');return {x:p.position.x,y:p.position.y};})()`,
    );
    results.push({
      partId: part.id,
      before: part.position,
      after: moved,
      dx: moved.x - part.position.x,
      dy: moved.y - part.position.y,
    });
  }
  const elapsedMs = Date.now() - startedAt;
  const screenshotFile = await screenshot("five-lcds-dragged.png");
  return {
    added,
    results,
    elapsedMs,
    screenshot: screenshotFile,
    pass: results.every((item) => item.dx > 0 && item.dy > 0),
  };
}

const result = {
  pinSafety: await pinSafety(),
  renderStates: await renderStates(),
  wiring: await wiring(),
  flip: await flip(),
  dragFive: await dragFive(),
  consoleErrors,
};
result.pass =
  result.pinSafety.pass &&
  result.renderStates.pass &&
  result.wiring.pass &&
  result.flip.pass &&
  result.dragFive.pass &&
  consoleErrors.length === 0;
const logFile = path.join(outDir, "acceptance-log.json");
fs.writeFileSync(logFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, logFile }, null, 2));
ws.close();

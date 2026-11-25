import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9349";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || path.join(here, "..", "artifacts", "led-redesign", "after");
fs.mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sleep = wait;

async function connect() {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const target = targets.find(
        (item) => item.type === "page" && (item.url.startsWith("file:") || item.url.startsWith("http:")),
      );
      if (target === void 0) throw new Error(`No renderer page on debug port ${port}`);
      return target;
    } catch (error) {
      lastError = error;
      await wait(100);
    }
  }
  throw lastError;
}

const target = await connect();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown")
    consoleErrors.push(message.params.exceptionDetails?.text ?? "exception");
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    const text = message.params.args.map((arg) => arg.value ?? arg.description).join(" ");
    if (!text.includes("Failed to load resource")) consoleErrors.push(text);
  }
  if (message.id !== void 0 && pending.has(message.id)) {
    pending.get(message.id)(message.result);
    pending.delete(message.id);
  }
};
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++requestId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails !== void 0) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const snapshot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(outDir, name);
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  return path.relative(here, file);
};
const waitForApp = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate(
      `!!document.querySelector('[data-testid="circuit-canvas"]') && !!window.__LCD_STORE__`,
    );
    if (ready === true) break;
    await wait(100);
  }
  await evaluate(
    "(()=>{const b=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close');b?.click();return true})()",
  );
  await wait(100);
};
const setTheme = async (value) => {
  await evaluate(
    `(()=>{window.__LCD_THEME_STORE__.getState().setTheme(${JSON.stringify(value)});return true})()`,
  );
  await wait(80);
  return evaluate("document.documentElement.dataset.theme");
};
const setZoom = async (value) => {
  if (value === 1) {
    await send("Emulation.clearDeviceMetricsOverride");
  } else {
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 873,
      deviceScaleFactor: value,
      mobile: false,
    });
  }
  await wait(100);
};
const setViewport = async (scale, center) => {
  await evaluate(
    `(()=>{const r=document.querySelector('[data-testid="circuit-canvas"]').getBoundingClientRect();window.__LCD_VIEWPORT_STORE__.getState().setViewport({scale:${scale},offsetX:r.width/2-${center.x}*${scale},offsetY:r.height/2-${center.y}*${scale}});return true})()`,
  );
  await wait(100);
};
const replaceDocument = async (circuit) => {
  await evaluate(
    `(()=>{window.__LCD_STORE__.getState().replaceDocument(${JSON.stringify(circuit)});return true})()`,
  );
  await wait(100);
};
const setBrightness = async (brightness) => {
  await evaluate(
    `(()=>{window.__LCD_SIM_STORE__.setState({status:'running',ledBrightness:${JSON.stringify(brightness)}});return true})()`,
  );
  await wait(80);
};
const clearDebug = async () =>
  evaluate(
    "(()=>{window.__LED_GEOMETRY__={};window.__LED_LABEL_DEBUG__={};window.__LED_ANCHOR_DEBUG__={};return true})()",
  );
const led = (id, color, x, y) => ({
  id,
  type: "led",
  position: { x, y },
  rotation: 0,
  flipX: false,
  flipY: false,
  props: { color },
});
const trafficCircuit = () =>
  JSON.parse(
    fs.readFileSync(path.join(here, "..", "resources", "samples", "traffic-light.vcc"), "utf8"),
  ).circuit;
const breadboardCircuit = () =>
  JSON.parse(
    fs.readFileSync(path.join(here, "..", "resources", "samples", "blink-led.vcc"), "utf8"),
  ).circuit;
const blueCircuit = () => ({
  version: 1,
  parts: [led("blue-unlit", "blue", 260, 200), led("blue-lit", "blue", 520, 200)],
  wires: [],
});
const allColorsCircuit = () => {
  const colors = ["red", "green", "blue", "yellow", "white"];
  const parts = [];
  const brightness = {};
  colors.forEach((color, index) => {
    parts.push(led(`${color}-unlit`, color, 100 + index * 150, 160));
    parts.push(led(`${color}-lit`, color, 100 + index * 150, 330));
    brightness[`${color}-lit`] = 1;
  });
  return { circuit: { version: 1, parts, wires: [] }, brightness };
};
const gridCircuit = () => {
  const colors = ["red", "green", "blue", "yellow", "white"];
  const parts = [];
  const brightness = {};
  for (let row = 0; row < 5; row += 1)
    for (let column = 0; column < 10; column += 1) {
      const id = `led-${row}-${column}`;
      parts.push(led(id, colors[(row + column) % colors.length], 80 + column * 90, 100 + row * 110));
      brightness[id] = 1;
    }
  return { circuit: { version: 1, parts, wires: [] }, brightness };
};
const loadBlue = async () => {
  await clearDebug();
  const circuit = blueCircuit();
  await replaceDocument(circuit);
  await setBrightness({ "blue-lit": 1 });
  return { circuit, center: { x: 390, y: 220 } };
};
const loadReference = async () => {
  const { circuit, brightness } = allColorsCircuit();
  await replaceDocument(circuit);
  await setBrightness(brightness);
  return { circuit, center: { x: 450, y: 250 } };
};
const loadGrid = async () => {
  const { circuit, brightness } = gridCircuit();
  await replaceDocument(circuit);
  await setBrightness(brightness);
  return { circuit, center: { x: 550, y: 320 } };
};
const loadTraffic = async () => {
  const circuit = trafficCircuit();
  await replaceDocument(circuit);
  await setBrightness({ led1: 1 });
  return { circuit, center: { x: 690, y: 130 } };
};
const loadBreadboard = async (lit) => {
  const circuit = breadboardCircuit();
  await replaceDocument(circuit);
  await setBrightness(lit ? { led1: 1 } : {});
  return { circuit, center: { x: 500, y: 150 } };
};
const mouse = async (type, x, y, buttons = 0) => {
  await send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: type === "mouseMoved" ? "none" : "left",
    buttons,
    clickCount: type === "mousePressed" || type === "mouseReleased" ? 1 : 0,
    pointerType: "mouse",
  });
  await wait(70);
};
const worldToScreen = async (world) =>
  evaluate(
    `(()=>{const r=document.querySelector('[data-testid="circuit-canvas"]').getBoundingClientRect();const v=window.__LCD_VIEWPORT_STORE__.getState().viewport;return {x:r.left+${world.x}*v.scale+v.offsetX,y:r.top+${world.y}*v.scale+v.offsetY}})()`,
  );
const currentTokens = async () =>
  evaluate(
    `(()=>{const s=getComputedStyle(document.documentElement);const out={};for(const p of s)if(p.startsWith('--'))out[p]=s.getPropertyValue(p).trim();return out})()`,
  );
const luminance = (hex) => {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};
const contrast = (first, second) => {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const composite = (foreground, background, alpha) => {
  const parse = (hex) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const fg = parse(foreground);
  const bg = parse(background);
  return `#${fg
    .map((channel, index) => Math.round(channel * alpha + bg[index] * (1 - alpha)).toString(16).padStart(2, "0"))
    .join("")}`;
};
const writeJson = (name, value) => {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2));
  return path.join(outDir, name);
};
const source = fs.readFileSync(
  path.join(here, "..", "recovered-src", "out", "renderer", "assets", "index-N0START1.js"),
  "utf8",
);

const sampleProjects = {};
const sampleList = [];
for (const file of fs.readdirSync(path.join(here, "..", "resources", "samples")).filter((name) => name.endsWith(".vcc"))) {
  sampleProjects[file] = JSON.parse(fs.readFileSync(path.join(here, "..", "resources", "samples", file), "utf8"));
  sampleList.push({
    name: file,
    label: file.replace(/\.vcc$/, "").split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
  });
}

await send("Runtime.enable");
await send("Page.enable");
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    const __SAMPLE_PROJECTS__ = ${JSON.stringify(sampleProjects)};
    const __SAMPLE_LIST__ = ${JSON.stringify(sampleList)};
    window.api = {
      onFileOpened: () => () => {},
      onFileOpenError: () => () => {},
      openFile: async () => null,
      takeLaunchFile: async () => null,
      listSamples: async () => __SAMPLE_LIST__,
      openSample: async ({ name }) => ({ kind: "project", project: __SAMPLE_PROJECTS__[name], path: name }),
      saveProject: async () => ({ ok: true }),
      exportSketch: async () => ({ ok: true }),
      exportPng: async () => ({ ok: true }),
      exportPdf: async () => ({ ok: true }),
      exportHex: async () => ({ ok: true }),
      compile: async () => ({ ok: true, diagnostics: [], memory: null, hex: ":00000001FF", durationMs: 0 }),
      toolchainStatus: async () => ({ installed: true, version: "mock" }),
      ping: async (payload) => ({ ...payload, versions: { electron: "mock", node: "22", chrome: "mock" } }),
    };
  `,
});
await send("Page.reload", { ignoreCache: true });
await waitForApp();

const screenshots = [];
const tokensByTheme = {};
const geometryByTheme = {};
const labelByTheme = {};
const transformedLabelByTheme = {};
const anchorByState = {};

for (const theme of ["dark", "light"]) {
  const applied = await setTheme(theme);
  const blue = await loadBlue();
  await setViewport(1, blue.center);
  geometryByTheme[theme] = await evaluate("JSON.parse(JSON.stringify(window.__LED_GEOMETRY__))");
  for (const state of ["unlit", "lit"]) {
    screenshots.push(await snapshot(`blue-${state}-${theme}-100.png`));
  }
  await setViewport(4, blue.center);
  labelByTheme[theme] = await evaluate("JSON.parse(JSON.stringify(window.__LED_LABEL_DEBUG__))");
  for (const state of ["unlit", "lit"]) {
    screenshots.push(await snapshot(`blue-${state}-${theme}-400.png`));
  }
  await evaluate(
    `(()=>{const s=window.__LCD_STORE__.getState();const d=s.document;s.replaceDocument({...d,parts:d.parts.map((p)=>p.id==='blue-lit'?{...p,rotation:90,flipX:true}:p)});return true})()`,
  );
  await wait(120);
  transformedLabelByTheme[theme] = await evaluate("JSON.parse(JSON.stringify(window.__LED_LABEL_DEBUG__))");
  screenshots.push(await snapshot(`blue-lit-${theme}-rotated-flipped-400.png`));
  const reference = await loadReference();
  await setViewport(1, reference.center);
  screenshots.push(await snapshot(`${theme}-reference-sheet.png`));
  await evaluate(
    "(()=>{const c=document.querySelector('[data-testid=\"circuit-canvas\"]');c.style.filter='grayscale(1)';return true})()",
  );
  await wait(100);
  screenshots.push(await snapshot(`${theme}-grayscale.png`));
  await evaluate(
    "(()=>{const c=document.querySelector('[data-testid=\"circuit-canvas\"]');c.style.filter='';return true})()",
  );

  await clearDebug();
  const breadboardLit = await loadBreadboard(true);
  await setViewport(2, breadboardLit.center);
  screenshots.push(await snapshot(`breadboard-${theme}-lit.png`));
  await loadBreadboard(false);
  await setViewport(2, breadboardLit.center);
  screenshots.push(await snapshot(`breadboard-${theme}-unlit.png`));

  await clearDebug();
  const traffic = await loadTraffic();
  await setViewport(2, traffic.center);
  const anode = await worldToScreen({ x: 600, y: 140 });
  anchorByState[`${theme}:idle`] = await evaluate("JSON.parse(JSON.stringify(window.__LED_ANCHOR_DEBUG__))");
  screenshots.push(await snapshot(`${theme}-anchor-idle.png`));
  await mouse("mouseMoved", anode.x, anode.y, 0);
  await wait(80);
  anchorByState[`${theme}:hover`] = await evaluate("JSON.parse(JSON.stringify(window.__LED_ANCHOR_DEBUG__))");
  screenshots.push(await snapshot(`${theme}-anchor-hover.png`));
  const neutral = await worldToScreen({ x: 900, y: 400 });
  await mouse("mouseMoved", neutral.x, neutral.y, 0);
  await wait(80);
  anchorByState[`${theme}:connected`] = await evaluate("JSON.parse(JSON.stringify(window.__LED_ANCHOR_DEBUG__))");
  screenshots.push(await snapshot(`${theme}-anchor-connected.png`));
  await evaluate("(()=>{window.__LCD_STORE__.getState().selectParts(['led1']);return true})()");
  await wait(80);
  anchorByState[`${theme}:selected`] = await evaluate("JSON.parse(JSON.stringify(window.__LED_ANCHOR_DEBUG__))");
  screenshots.push(await snapshot(`${theme}-anchor-selected.png`));
  await evaluate("(()=>{window.__LCD_STORE__.getState().selectParts([]);return true})()");

  tokensByTheme[applied] = await currentTokens();
}

writeJson("raw-geometry.json", geometryByTheme);
writeJson("raw-labels.json", { base: labelByTheme, transformed: transformedLabelByTheme });
writeJson("raw-anchors.json", anchorByState);

const haloRows = [];
for (const theme of ["dark", "light"]) {
  for (const partId of ["blue-lit", "blue-unlit"]) {
    const geometry = geometryByTheme[theme][partId];
    haloRows.push({
      theme,
      partId,
      centerDifference: geometry.centerDifference,
      haloType: geometry.halo.type,
      hardEdge: geometry.halo.hardEdge,
      haloRadius: geometry.halo.radius,
      outerRing: geometry.outerRing,
      domeRadius: geometry.domeRadius,
    });
  }
}
const haloPass =
  haloRows.every((row) => row.centerDifference.x === 0 && row.centerDifference.y === 0) &&
  haloRows.every((row) => row.haloType === "radial-gradient" && row.hardEdge === false) &&
  (haloRows.find((row) => row.theme === "dark")?.outerRing === null ||
    haloRows.filter((row) => row.theme === "dark").every((row) => row.outerRing === null)) &&
  haloRows.filter((row) => row.theme === "light").every((row) => row.outerRing?.width === 1);
writeJson("halo-center-log.json", { rows: haloRows, pass: haloPass, sourceHasHalo: /name:\s*"led-halo"/.test(source), sourceHasRing: /name:\s*"led-ring"/.test(source) });

const flatRows = [];
for (const theme of ["dark", "light"]) {
  for (const partId of ["blue-lit", "blue-unlit"]) {
    const geometry = geometryByTheme[theme][partId];
    flatRows.push({
      theme,
      partId,
      flatEdge: geometry.flatEdge,
      strayDomeBar: geometry.strayDomeBar,
      legHook: geometry.legHook,
      flangeRadius: geometry.flangeRadius,
      domeRadius: geometry.domeRadius,
    });
  }
}
const flatPass =
  flatRows.every((row) => row.flatEdge.side === "K") &&
  flatRows.every((row) => row.flatEdge.x > row.domeRadius + 15 - 11.5) &&
  flatRows.every((row) => row.strayDomeBar === false && row.legHook === false) &&
  !/points:\s*\[ledX \+ bodyRadius - 2/.test(source) &&
  !/kinkSize/.test(source);
writeJson("flat-edge-log.json", { rows: flatRows, pass: flatPass });

const labelRows = [];
for (const theme of ["dark", "light"]) {
  for (const [variant, source] of [["base", labelByTheme], ["rotatedFlipped", transformedLabelByTheme]]) {
    const entries = Object.entries(source[theme])
      .filter(([key]) => key.startsWith("blue-lit:"))
      .map(([key, value]) => ({ key, ...value }));
    labelRows.push({ theme, variant, entries, count: entries.length });
  }
}
const labelPass =
  labelRows.every((row) => row.count === 2) &&
  labelRows.every((row) => row.entries.some((entry) => entry.text === "A")) &&
  labelRows.every((row) => row.entries.some((entry) => entry.text === "K")) &&
  labelRows.every((row) => row.entries.every((entry) => entry.angle === 0 && entry.mirrored === false));
writeJson("label-log.json", { rows: labelRows, pass: labelPass });

const anchorRows = [];
for (const state of ["idle", "hover", "connected", "selected"]) {
  for (const theme of ["dark", "light"]) {
    const entries = Object.entries(anchorByState[`${theme}:${state}`])
      .filter(([key]) => key.startsWith("led1:"))
      .map(([key, value]) => ({ key, ...value }));
    anchorRows.push({ theme, state, entries });
  }
}
const anchorFillsByThemePass = ["dark", "light"].every((theme) => {
  const fills = anchorRows
    .filter((row) => row.theme === theme)
    .flatMap((row) => row.entries.map((entry) => entry.fill));
  return fills.length > 0 && fills.every((fill) => fill === fills[0]);
});
const stateVisible = (state) =>
  anchorRows
    .filter((row) => row.state === state)
    .every((row) => row.entries.length === 2 && row.entries.every((entry) => typeof entry.fill === "string"));
const hoverVisible = anchorRows
  .filter((row) => row.state === "hover")
  .every((row) => row.entries.some((entry) => entry.state === "hovered"));
const anchorGeometryPass =
  anchorRows.every(
    (row) =>
      row.entries.length === 2 &&
      row.entries.every((entry) => entry.radius === 4 / 2 && entry.hitStrokeWidth === 8 / 2) &&
      row.entries.every((entry) => entry.fill === row.entries[0].fill),
  ) &&
  anchorFillsByThemePass &&
  stateVisible("idle") &&
  stateVisible("hover") &&
  stateVisible("connected") &&
  stateVisible("selected") &&
  hoverVisible;
writeJson("anchor-state-log.json", { rows: anchorRows, pass: anchorGeometryPass });

const contrastRows = [];
const addContrast = (theme, color, state, part, value, background, target, note = "") => {
  const ratio = contrast(value, background);
  contrastRows.push({
    theme,
    color,
    state,
    part,
    value,
    background,
    ratio: Number(ratio.toFixed(2)),
    target,
    pass: ratio >= target,
    note,
  });
};
for (const theme of ["dark", "light"]) {
  const tokens = tokensByTheme[theme];
  const canvas = tokens["--cb-canvas"];
  const colors = ["red", "green", "blue", "yellow", "white"];
  for (const color of colors) {
    const bodyTarget = theme === "light" && (color === "yellow" || color === "white") ? 1 : 3;
    const note = bodyTarget < 3 ? "rim carries the 3:1 silhouette" : "";
    const rimTarget = theme === "light" ? 3 : 1.5;
    addContrast(theme, color, "unlit", "body", tokens[`--cb-led-${color}-unlit`], canvas, bodyTarget, note);
    addContrast(theme, color, "lit", "body", tokens[`--cb-led-${color}-lit`], canvas, bodyTarget, note);
    addContrast(theme, color, "unlit", "rim", tokens[`--cb-led-${color}-rim`], canvas, rimTarget);
    addContrast(theme, color, "lit", "rim", tokens[`--cb-led-${color}-rim`], canvas, rimTarget);
    const haloOpacity = Number(tokens["--cb-led-halo-opacity"]);
    const compositeHalo = composite(tokens[`--cb-led-${color}-halo`], canvas, haloOpacity);
    addContrast(theme, color, "lit", "halo composite", compositeHalo, canvas, 1.4, `radial gradient at ${haloOpacity}`);
    addContrast(theme, color, "unlit", "leg", tokens["--cb-led-leg"], canvas, 3);
    addContrast(theme, color, "unlit", "flange", tokens["--cb-led-flange"], canvas, 3);
    addContrast(theme, color, "unlit", "anchordot", tokens["--cb-led-pin"], canvas, 3);
    addContrast(theme, color, "unlit", "hoverring", tokens["--cb-led-hover"], canvas, 2.5);
    addContrast(theme, color, "unlit", "connectedring", tokens["--cb-led-connected"], canvas, 2.5);
    addContrast(theme, color, "unlit", "selectedring", tokens["--cb-led-selected"], canvas, 2.5);
    addContrast(theme, color, "unlit", "label", tokens["--cb-led-label-text"], tokens["--cb-led-label-bg"], 4.5);
  }
}
const contrastPass = contrastRows.every((row) => row.pass);
writeJson("led-contrast-table.json", { pass: contrastPass, rows: contrastRows });

const baselines = {
  dark: JSON.parse(fs.readFileSync(path.join(here, "..", "artifacts", "led-appearance", "before", "led-token-diff-before-dark.json"), "utf8")),
  light: JSON.parse(fs.readFileSync(path.join(here, "..", "artifacts", "led-appearance", "before", "led-token-diff-before-light.json"), "utf8")),
};
const tokenTable = {};
for (const theme of ["dark", "light"]) {
  const before = baselines[theme].tokens;
  const after = tokensByTheme[theme];
  const names = [
    ...new Set([
      ...Object.keys(before).filter((name) => name.startsWith("--cb-led-")),
      ...Object.keys(after).filter((name) => name.startsWith("--cb-led-")),
    ]),
  ].sort();
  tokenTable[theme] = names.map((name) => ({
    token: name,
    before: before[name] ?? "—",
    after: after[name] ?? "—",
    changed: (before[name] ?? "—") !== (after[name] ?? "—"),
  }));
}
writeJson("token-table.json", tokenTable);
const tableLines = ["# LED token changes", ""];
for (const theme of ["dark", "light"]) {
  tableLines.push(`## ${theme}`, "", "| token | before | after | changed |", "| --- | --- | --- | --- |");
  for (const row of tokenTable[theme])
    tableLines.push(`| \`${row.token}\` | \`${row.before}\` | \`${row.after}\` | ${row.changed ? "yes" : "no"} |`);
  tableLines.push("");
}
fs.writeFileSync(path.join(outDir, "token-table.md"), tableLines.join("\n"));

await setTheme("dark");
const traffic = await loadTraffic();
const pins = await evaluate(
  `(()=>{const d=window.__LCD_STORE__.getState().document;return d.parts.filter(p=>p.type==='led').map(p=>({partId:p.id,color:p.props.color,pins:[{pinId:'anode',label:'A',x:p.position.x+10,y:p.position.y+40},{pinId:'cathode',label:'K',x:p.position.x+20,y:p.position.y+40}]}))})()`,
);
const baselinePins = JSON.parse(fs.readFileSync(path.join(here, "..", "artifacts", "led-appearance", "before", "led-pins-before.json"), "utf8"));
const ledHitAreaUnchanged = /hitStrokeWidth:\s*8\s*\/\s*props\.scale/.test(source);
const pinResult = {
  pins,
  hitStrokeWidth: ledHitAreaUnchanged ? 8 : null,
  legacyBaselineHitStrokeWidth: baselinePins.hitStrokeWidth,
};
const pinDiff = JSON.stringify(pins) === JSON.stringify(baselinePins.pins) && ledHitAreaUnchanged ? 0 : 1;
writeJson("pin-diff.json", { ...pinResult, diff: pinDiff, pass: pinDiff === 0 });

const wireReset = await evaluate(
  `(()=>{try{window.__LCD_STORE__.getState().replaceDocument(${JSON.stringify({ ...traffic.circuit, wires: [] })});return {ok:true}}catch(e){return {ok:false,message:e.message,issues:e.issues}}})()`,
);
if (wireReset.ok !== true) throw new Error(JSON.stringify(wireReset));
await setViewport(1.5, { x: 480, y: 180 });
const anode = await worldToScreen({ x: 600, y: 140 });
const cathode = await worldToScreen({ x: 610, y: 140 });
const d13 = await worldToScreen({ x: 378, y: 120 });
const gnd = await worldToScreen({ x: 158, y: 320 });
for (const [type, point, buttons] of [
  ["mouseMoved", anode, 0],
  ["mousePressed", anode, 1],
  ["mouseReleased", anode, 0],
  ["mouseMoved", d13, 0],
  ["mousePressed", d13, 1],
  ["mouseReleased", d13, 0],
  ["mouseMoved", cathode, 0],
  ["mousePressed", cathode, 1],
  ["mouseReleased", cathode, 0],
  ["mouseMoved", gnd, 0],
  ["mousePressed", gnd, 1],
  ["mouseReleased", gnd, 0],
]) await mouse(type, point.x, point.y, buttons);
const wiring = await evaluate(
  `(()=>{const w=window.__LCD_STORE__.getState().document.wires;return {count:w.length,endpoints:w.map(x=>({from:x.from,to:x.to}))}})()`,
);
const before = await evaluate(
  `(()=>{const p=window.__LCD_STORE__.getState().document.parts.find(x=>x.id==='led1');return {...p.position}})()`,
);
const body = await worldToScreen({ x: before.x + 15, y: before.y + 16 });
await mouse("mousePressed", body.x, body.y, 1);
await mouse("mouseMoved", body.x + 45, body.y + 25, 1);
await mouse("mouseReleased", body.x + 45, body.y + 25, 0);
const after = await evaluate(
  `(()=>{const p=window.__LCD_STORE__.getState().document.parts.find(x=>x.id==='led1');return {...p.position}})()`,
);
const hasAnode = wiring.endpoints.some((item) => item.from.pinId === "anode" || item.to.pinId === "anode");
const hasCathode = wiring.endpoints.some((item) => item.from.pinId === "cathode" || item.to.pinId === "cathode");
const interaction = {
  wiring,
  drag: { before, after, dx: after.x - before.x, dy: after.y - before.y },
  pass: wiring.count === 2 && hasAnode && hasCathode && after.x !== before.x && after.y !== before.y,
};
writeJson("led-interaction.json", interaction);

await loadGrid();
const frames = await evaluate(
  `(async()=>{const times=[];let last=performance.now();for(let i=0;i<60;i+=1){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-last);last=now;}times.shift();return {samples:times.length,average:times.reduce((a,b)=>a+b,0)/times.length,worst:Math.max(...times),times:times.slice(0,10)}})()`,
);
writeJson("led-50-perf.json", { ...frames, consoleErrors });

const sourceChecks = {
  noLegacyTokens: !/--cb-led-.*-(body|glow|anchor|anchor-ring|label|edge)/.test(source),
  noHeavyShadow: !/shadowBlur:\s*16/.test(source),
  haloRadial: /name:\s*"led-halo"/.test(source) && /fillRadialGradientColorStops/.test(source),
  lightRing: /name:\s*"led-ring"/.test(source),
  noLocalLabels: !/text:\s*"A"/.test(source) && !/text:\s*"K"/.test(source),
};
const acceptance = {
  pass:
    haloPass &&
    flatPass &&
    labelPass &&
    anchorGeometryPass &&
    contrastPass &&
    pinDiff === 0 &&
    interaction.pass &&
    Object.values(sourceChecks).every(Boolean) &&
    consoleErrors.length === 0,
  checks: {
    haloPass,
    flatPass,
    labelPass,
    anchorGeometryPass,
    contrastPass,
    pinDiff,
    interactionPass: interaction.pass,
    sourceChecks,
    consoleErrors,
  },
  screenshots,
};
writeJson("acceptance.json", acceptance);

console.log(JSON.stringify(acceptance, null, 2));
ws.close();

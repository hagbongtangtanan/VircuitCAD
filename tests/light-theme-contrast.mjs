import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || path.join(here, "..", "artifacts", "light-theme");
fs.mkdirSync(outDir, { recursive: true });

const tokenNames = [
  "--cb-page",
  "--cb-surface",
  "--cb-surface-sunken",
  "--cb-surface-hover",
  "--cb-border",
  "--cb-border-strong",
  "--cb-text",
  "--cb-text-muted",
  "--cb-text-faint",
  "--cb-primary",
  "--cb-primary-hover",
  "--cb-primary-soft",
  "--cb-on-primary",
  "--cb-run",
  "--cb-run-hover",
  "--cb-stop",
  "--cb-stop-hover",
  "--cb-stop-soft",
  "--cb-warn",
  "--cb-warn-soft",
  "--cb-warn-border",
  "--cb-on-stop",
  "--cb-canvas",
  "--cb-canvas-grid",
  "--cb-canvas-grid-strong",
  "--cb-schematic-wire",
  "--cb-wire-positive",
  "--cb-wire-ground",
  "--cb-wire-signal",
  "--cb-wire-signal-blue",
  "--cb-wire-signal-ice",
  "--cb-wire-ink",
  "--cb-wire-selected",
  "--cb-wire-waypoint",
  "--cb-damage-text",
  "--cb-damage-border",
  "--cb-damage-active-text",
  "--cb-damage-active-border",
  "--cb-damage-warning",
];

const pairs = [
  ["body text", "--cb-text", "--cb-surface", 4.5, 1],
  ["muted text", "--cb-text-muted", "--cb-surface", 4.5, 1],
  ["faint text", "--cb-text-faint", "--cb-surface", 4.5, 1],
  ["primary text", "--cb-primary", "--cb-surface", 4.5, 1],
  ["primary on soft", "--cb-primary", "--cb-primary-soft", 4.5, 1],
  ["on primary", "--cb-on-primary", "--cb-primary", 4.5, 1],
  ["run button", "--cb-on-primary", "--cb-run", 4.5, 1],
  ["stop button", "--cb-on-stop", "--cb-stop", 4.5, 1],
  ["warning badge", "--cb-warn", "--cb-warn-soft", 4.5, 1],
  ["border", "--cb-border", "--cb-surface", 3, 1],
  ["strong border", "--cb-border-strong", "--cb-surface", 3, 1],
  ["warning border", "--cb-warn-border", "--cb-warn-soft", 3, 1],
  ["damage text", "--cb-damage-text", "--cb-surface", 4.5, 1],
  ["damage active", "--cb-damage-active-text", "--cb-surface", 4.5, 1],
  ["damage warning", "--cb-damage-warning", "--cb-surface", 4.5, 1],
  ["disabled control", "--cb-text-muted", "--cb-surface", 2, 0.62],
  ["canvas grid", "--cb-canvas-grid", "--cb-canvas", 3, 1],
  ["canvas major grid", "--cb-canvas-grid-strong", "--cb-canvas", 3, 1],
  ["schematic wire", "--cb-schematic-wire", "--cb-canvas", 3, 1],
  ["wire positive", "--cb-wire-positive", "--cb-canvas", 3, 1],
  ["wire ground", "--cb-wire-ground", "--cb-canvas", 3, 1],
  ["wire signal", "--cb-wire-signal", "--cb-canvas", 3, 1],
  ["wire signal blue", "--cb-wire-signal-blue", "--cb-canvas", 3, 1],
  ["wire signal ice", "--cb-wire-signal-ice", "--cb-canvas", 3, 1],
  ["wire ink", "--cb-wire-ink", "--cb-canvas", 3, 1],
  ["wire selected", "--cb-wire-selected", "--cb-canvas", 3, 1],
  ["waypoint outline on positive", "--cb-wire-waypoint", "--cb-wire-positive", 3, 1],
  ["waypoint outline on ground", "--cb-wire-waypoint", "--cb-wire-ground", 3, 1],
  ["waypoint outline on signal", "--cb-wire-waypoint", "--cb-wire-signal", 3, 1],
  ["waypoint outline on signal blue", "--cb-wire-waypoint", "--cb-wire-signal-blue", 3, 1],
  ["waypoint outline on signal ice", "--cb-wire-waypoint", "--cb-wire-signal-ice", 3, 1],
  ["waypoint outline on ink", "--cb-wire-waypoint", "--cb-wire-ink", 3, 1],
  ["swatch positive", "--cb-wire-positive", "--cb-surface-sunken", 3, 1],
  ["swatch ground", "--cb-wire-ground", "--cb-surface-sunken", 3, 1],
  ["swatch signal", "--cb-wire-signal", "--cb-surface-sunken", 3, 1],
  ["swatch signal blue", "--cb-wire-signal-blue", "--cb-surface-sunken", 3, 1],
  ["swatch signal ice", "--cb-wire-signal-ice", "--cb-surface-sunken", 3, 1],
  ["swatch ink", "--cb-wire-ink", "--cb-surface-sunken", 3, 1],
];

const fontSelectors = [
  ".cb-beta-badge",
  ".cb-serial-badge",
  ".cb-tour-eyebrow",
  ".cb-eyebrow",
  ".cb-chip span",
  ".cb-sample-group-count",
  ".cb-shortcut-group h3",
  ".cb-sch-designator",
  ".cb-sch-value",
  ".cb-sch-netlabel",
  ".cb-sch-original-value",
  ".cb-sch-original-pin-name",
  ".cb-sch-original-pin-number",
  ".cb-sch-titleblock-project",
  ".cb-sch-titleblock-sheet",
];

function parseColor(value) {
  const text = String(value).trim();
  const hex = text.match(/^#([0-9a-f]{3,8})$/i);
  if (hex !== null) {
    const raw = hex[1];
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
    ];
  }
  const numbers = text.match(/[\d.]+/g);
  if (numbers !== null && numbers.length >= 3) {
    return [
      Number(numbers[0]),
      Number(numbers[1]),
      Number(numbers[2]),
      numbers.length >= 4 ? Number(numbers[3]) : 1,
    ];
  }
  throw new Error(`Unsupported color: ${text}`);
}

function composite(color, alpha, background) {
  return color.map((channel, index) =>
    index === 3
      ? 1
      : channel * alpha + background[index] * (1 - alpha),
  );
}

function luminance(color) {
  const channels = color.slice(0, 3).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page" && item.url.startsWith("file:"));
if (target === void 0) throw new Error(`No renderer page on debug port ${port}`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
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
  if (result.exceptionDetails !== void 0)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};

await send("Runtime.enable");
await evaluate(`(()=>{document.documentElement.dataset.theme='light';return true})()`);

const passes = [];
for (const media of ["normal", "more", "less"]) {
  if (media === "normal")
    await send("Emulation.setEmulatedMedia", { features: [] });
  else
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-contrast", value: media }],
    });
  const tokens = await evaluate(`(()=>{
    const style=getComputedStyle(document.documentElement);
    return ${JSON.stringify(tokenNames)}.reduce((result,name)=>{
      result[name]=style.getPropertyValue(name).trim();
      return result;
    },{});
  })()`);
  const fonts = await evaluate(`(()=>{
    const selectors=${JSON.stringify(fontSelectors)};
    return selectors.map((selector)=>{
      const element=document.querySelector(selector);
      return {selector,fontSize:element ? getComputedStyle(element).fontSize : null};
    });
  })()`);
  const rows = pairs.map(([name, fg, bg, min, opacity]) => {
    const foreground = composite(parseColor(tokens[fg]), opacity, parseColor(tokens[bg]));
    const ratio = contrast(foreground, parseColor(tokens[bg]));
    return {
      name,
      foreground: tokens[fg],
      background: tokens[bg],
      opacity,
      min,
      ratio: Number(ratio.toFixed(2)),
      pass: ratio >= min,
    };
  });
  const fontRows = fonts.map((item) => ({
    ...item,
    pass: item.fontSize === null || Number.parseFloat(item.fontSize) >= 11,
  }));
  passes.push({
    media,
    tokens,
    rows,
    fonts: fontRows,
    pass: rows.every((row) => row.pass) && fontRows.every((row) => row.pass),
  });
}

await send("Emulation.setEmulatedMedia", { features: [] });
const result = {
  theme: "light",
  port,
  passes,
  pass: passes.every((item) => item.pass),
};
const file = path.join(outDir, "light-theme-contrast.json");
fs.writeFileSync(file, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      file,
      pass: result.pass,
      summaries: passes.map((item) => ({
        media: item.media,
        pass: item.pass,
        failures: [
          ...item.rows.filter((row) => !row.pass).map((row) => row.name),
          ...item.fonts.filter((row) => !row.pass).map((row) => row.selector),
        ],
        lowest: Math.min(...item.rows.map((row) => row.ratio)),
      })),
    },
    null,
    2,
  ),
);
ws.close();

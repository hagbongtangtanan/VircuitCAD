import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const command = process.argv[2] || "capture";
const label = process.env.LABEL || command;
const theme = process.env.THEME || "light";
const zoom = Number(process.env.ZOOM || 1);
const viewScale = Number(process.env.VIEW_SCALE || 1);
const circuitMode = process.env.CIRCUIT || "traffic";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || path.join(here, "..", "artifacts", "led-appearance");
fs.mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page" && item.url.startsWith("file:"));
if (target === void 0) throw new Error(`No renderer page on debug port ${port}`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown")
    consoleErrors.push(message.params.exceptionDetails?.text ?? "exception");
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
    consoleErrors.push(
      message.params.args.map((arg) => arg.value ?? arg.description).join(" "),
    );
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
const snapshot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(outDir, name);
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  return file;
};
const waitForApp = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate(
      `!!document.querySelector('[data-testid="circuit-canvas"]')`,
    );
    if (ready === true) break;
    await wait(100);
  }
  await evaluate(
    "(()=>{const b=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close');b?.click();return true})()",
  );
  await wait(250);
};
const setTheme = async (value) => {
  await evaluate(
    `(()=>{localStorage.setItem('vircuitcad.theme',${JSON.stringify(value)});return true})()`,
  );
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
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
  await wait(350);
};
const setViewport = async (scale, center) => {
  await evaluate(
    `(()=>{const r=document.querySelector('[data-testid="circuit-canvas"]').getBoundingClientRect();window.__LCD_VIEWPORT_STORE__.getState().setViewport({scale:${scale},offsetX:r.width/2-${center.x}*${scale},offsetY:r.height/2-${center.y}*${scale}});return true})()`,
  );
  await wait(350);
};
const replaceDocument = async (circuit) => {
  await evaluate(
    `(()=>{window.__LCD_STORE__.getState().replaceDocument(${JSON.stringify(circuit)});return true})()`,
  );
  await wait(350);
};
const trafficCircuit = () =>
  JSON.parse(
    fs.readFileSync(
      path.join(here, "..", "resources", "samples", "traffic-light.vcc"),
      "utf8",
    ),
  ).circuit;
const led = (id, color, x, y) => ({
  id,
  type: "led",
  position: { x, y },
  rotation: 0,
  flipX: false,
  flipY: false,
  props: { color },
});
const allColorsCircuit = () => {
  const colors = ["red", "green", "blue", "yellow", "white"];
  const parts = [];
  colors.forEach((color, index) => {
    parts.push(led(`${color}-unlit`, color, 120 + index * 150, 160));
    parts.push(led(`${color}-lit`, color, 120 + index * 150, 330));
  });
  return { version: 1, parts, wires: [] };
};
const gridCircuit = () => {
  const colors = ["red", "green", "blue", "yellow", "white"];
  const parts = [];
  for (let row = 0; row < 5; row += 1)
    for (let column = 0; column < 10; column += 1)
      parts.push(
        led(`led-${row}-${column}`, colors[(row + column) % colors.length], 80 + column * 90, 100 + row * 110),
      );
  return { version: 1, parts, wires: [] };
};
const setBrightness = async (brightness) => {
  await evaluate(
    `(()=>{window.__LCD_SIM_STORE__.setState({status:'running',ledBrightness:${JSON.stringify(brightness)}});return true})()`,
  );
  await wait(350);
};
const loadCircuit = async (mode) => {
  if (mode === "traffic") {
    const circuit = trafficCircuit();
    await replaceDocument(circuit);
    await setBrightness({ led1: 1 });
    return { circuit, center: { x: 690, y: 130 } };
  }
  if (mode === "all") {
    const circuit = allColorsCircuit();
    await replaceDocument(circuit);
    const brightness = {};
    for (const color of ["red", "green", "blue", "yellow", "white"])
      brightness[`${color}-lit`] = 1;
    await setBrightness(brightness);
    return { circuit, center: { x: 450, y: 250 } };
  }
  if (mode === "grid") {
    const circuit = gridCircuit();
    await replaceDocument(circuit);
    const brightness = {};
    for (const part of circuit.parts) brightness[part.id] = 1;
    await setBrightness(brightness);
    return { circuit, center: { x: 550, y: 320 } };
  }
  throw new Error(`Unknown circuit mode ${mode}`);
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
  await wait(120);
};
const worldToScreen = async (world) => {
  const result = await evaluate(
    `(()=>{const r=document.querySelector('[data-testid="circuit-canvas"]').getBoundingClientRect();const v=window.__LCD_VIEWPORT_STORE__.getState().viewport;return {x:r.left+${world.x}*v.scale+v.offsetX,y:r.top+${world.y}*v.scale+v.offsetY}})()`,
  );
  return result;
};
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
  const parse = (hex) =>
    [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const fg = parse(foreground);
  const bg = parse(background);
  return `#${fg
    .map((channel, index) => Math.round(channel * alpha + bg[index] * (1 - alpha)).toString(16).padStart(2, "0"))
    .join("")}`;
};

await send("Runtime.enable");
await send("Page.enable");
await waitForApp();

if (command === "tokens") {
  const applied = await setTheme(theme);
  const tokens = await evaluate(
    `(()=>{const s=getComputedStyle(document.documentElement);const out={};for(const p of s)if(p.startsWith('--'))out[p]=s.getPropertyValue(p).trim();return out})()`,
  );
  const file = path.join(outDir, `led-token-diff-${label}.json`);
  fs.writeFileSync(file, JSON.stringify({ theme: applied, tokens }, null, 2));
  console.log(JSON.stringify({ theme: applied, count: Object.keys(tokens).length, file }, null, 2));
} else if (command === "contrast") {
  const applied = await setTheme("light");
  if (applied !== "light") throw new Error(`Theme is ${applied}`);
  const tokens = await evaluate(
    `(()=>{const s=getComputedStyle(document.documentElement);const names=['--cb-canvas',...Object.keys(localStorage)];const get=(n)=>s.getPropertyValue(n).trim();const out={canvas:get('--cb-canvas')};for(const c of ['red','green','blue','yellow','white'])for(const k of ['body','lit','glow'])out[c+'-'+k]=get('--cb-led-'+c+'-'+k);for(const k of ['rim','leg','flange','edge','label','anchor','anchor-ring','hover','selected','connected','core'])out[k]=get('--cb-led-'+k);out['glow-opacity']=Number(get('--cb-led-glow-opacity'));return out})()`,
  );
  const rows = [];
  const add = (color, state, part, value, target, note = "") => {
    const ratio = contrast(value, tokens.canvas);
    rows.push({
      color,
      state,
      part,
      value,
      background: tokens.canvas,
      ratio: Number(ratio.toFixed(2)),
      target,
      pass: ratio >= target,
      note,
    });
  };
  for (const color of ["red", "green", "blue", "yellow", "white"]) {
    const bodyTarget = color === "white" ? 1 : color === "yellow" ? 1.5 : 3;
    const bodyNote = bodyTarget < 3 ? "rim carries the 3:1 silhouette" : "";
    add(color, "unlit", "body", tokens[`${color}-body`], bodyTarget, bodyNote);
    add(color, "lit", "body", tokens[`${color}-lit`], bodyTarget, bodyNote);
    const ring = composite(tokens[`${color}-glow`], tokens.canvas, tokens["glow-opacity"]);
    add(color, "lit", "glow ring", ring, 1.5, `composite of ${tokens[`${color}-glow`]} at ${tokens["glow-opacity"]}`);
    for (const state of ["unlit", "lit"]) {
      add(color, state, "rim", tokens.rim, 3);
      add(color, state, "leg", tokens.leg, 3);
      add(color, state, "flange", tokens.flange, 3);
      add(color, state, "anchor dot", tokens.anchor, 3);
      add(color, state, "label", tokens.label, 4.5);
      add(color, state, "hover ring", tokens.hover, 3);
      add(color, state, "connected ring", tokens.connected, 3);
      add(color, state, "selected ring", tokens.selected, 3);
    }
  }
  const result = { pass: rows.every((row) => row.pass), rows, consoleErrors };
  const file = path.join(outDir, "led-contrast-table.json");
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} else if (command === "capture") {
  const applied = await setTheme(theme);
  await setZoom(zoom);
  const { center } = await loadCircuit(circuitMode);
  await setViewport(viewScale, center);
  const name = `${label}-${theme}-${Math.round(zoom * 100)}.png`;
  const file = await snapshot(name);
  const result = {
    label,
    theme: applied,
    zoom,
    viewScale,
    circuit: circuitMode,
    file,
    consoleErrors,
  };
  fs.writeFileSync(path.join(outDir, `${label}-${theme}-${Math.round(zoom * 100)}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} else if (command === "grayscale") {
  await setTheme("light");
  await loadCircuit(circuitMode);
  await setViewport(viewScale, { x: 690, y: 130 });
  await evaluate(
    `(()=>{const c=document.querySelector('[data-testid="circuit-canvas"]');c.style.filter='grayscale(1)';return true})()`,
  );
  await wait(350);
  const file = await snapshot(`${label}-grayscale.png`);
  await evaluate(
    `(()=>{const c=document.querySelector('[data-testid="circuit-canvas"]');c.style.filter='';return true})()`,
  );
  console.log(JSON.stringify({ file, consoleErrors }, null, 2));
} else if (command === "states") {
  await setTheme("light");
  const { center } = await loadCircuit("traffic");
  await setViewport(2, center);
  const state = process.env.STATE || "connected";
  if (state === "selected") {
    await evaluate(`(()=>{window.__LCD_STORE__.getState().selectParts(['led1']);return true})()`);
  } else if (state === "hover") {
    const point = await worldToScreen({ x: 600, y: 140 });
    await mouse("mouseMoved", point.x, point.y, 0);
  }
  await wait(350);
  const file = await snapshot(`${label}-${state}.png`);
  console.log(JSON.stringify({ file, state, consoleErrors }, null, 2));
} else if (command === "pins") {
  await setTheme("light");
  await loadCircuit("traffic");
  const pins = await evaluate(
    `(()=>{const d=window.__LCD_STORE__.getState().document;return d.parts.filter(p=>p.type==='led').map(p=>({partId:p.id,color:p.props.color,pins:[{pinId:'anode',label:'A',x:p.position.x+10,y:p.position.y+40},{pinId:'cathode',label:'K',x:p.position.x+20,y:p.position.y+40}]}))})()`,
  );
  const source = fs.readFileSync(
    path.join(here, "..", "recovered-src", "out", "renderer", "assets", "index-N0START1.js"),
    "utf8",
  );
  const match = source.match(/hitStrokeWidth:\s*([\d.]+)\s*\/\s*props\.scale/);
  const result = {
    pins,
    hitStrokeWidth: match === null ? null : Number(match[1]),
  };
  const file = path.join(outDir, `led-pins-${label}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, file }, null, 2));
} else if (command === "interaction") {
  await setTheme("light");
  const circuit = trafficCircuit();
  await replaceDocument({ ...circuit, wires: [] });
  await setViewport(1.5, { x: 480, y: 180 });
  const anode = await worldToScreen({ x: 600, y: 140 });
  const cathode = await worldToScreen({ x: 610, y: 140 });
  const d13 = await worldToScreen({ x: 378, y: 120 });
  const gnd = await worldToScreen({ x: 158, y: 320 });
  await mouse("mouseMoved", anode.x, anode.y, 0);
  await mouse("mousePressed", anode.x, anode.y, 1);
  await mouse("mouseReleased", anode.x, anode.y, 0);
  await mouse("mouseMoved", d13.x, d13.y, 0);
  await mouse("mousePressed", d13.x, d13.y, 1);
  await mouse("mouseReleased", d13.x, d13.y, 0);
  await mouse("mouseMoved", cathode.x, cathode.y, 0);
  await mouse("mousePressed", cathode.x, cathode.y, 1);
  await mouse("mouseReleased", cathode.x, cathode.y, 0);
  await mouse("mouseMoved", gnd.x, gnd.y, 0);
  await mouse("mousePressed", gnd.x, gnd.y, 1);
  await mouse("mouseReleased", gnd.x, gnd.y, 0);
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
  const debug = await evaluate(
    `(()=>{const w=document.querySelector('[data-testid="circuit-canvas"]');const c=w.querySelector('canvas');const r=w.getBoundingClientRect();const cr=c?.getBoundingClientRect();const hit=document.elementFromPoint(${anode.x},${anode.y});return {rect:{left:r.left,top:r.top,width:r.width,height:r.height},canvasRect:cr&&{left:cr.left,top:cr.top,width:cr.width,height:cr.height},hitTag:hit?.tagName,hitClass:hit?.className,viewport:window.__LCD_VIEWPORT_STORE__.getState().viewport}})()`,
  );
  const result = {
    wiring,
    drag: { before, after, dx: after.x - before.x, dy: after.y - before.y },
    debug: { ...debug, points: { anode, cathode, d13, gnd, body } },
    pass: wiring.count === 2 && hasAnode && hasCathode && after.x !== before.x && after.y !== before.y,
    consoleErrors,
  };
  fs.writeFileSync(path.join(outDir, "led-interaction.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} else if (command === "perf") {
  await setTheme("light");
  await loadCircuit("grid");
  const frames = await evaluate(
    `(async()=>{const times=[];let last=performance.now();for(let i=0;i<120;i+=1){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-last);last=now;}times.shift();return {samples:times.length,average:times.reduce((a,b)=>a+b,0)/times.length,worst:Math.max(...times),times:times.slice(0,10)}})()`,
  );
  const result = { ...frames, consoleErrors };
  fs.writeFileSync(path.join(outDir, "led-50-perf.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} else {
  throw new Error(`Unknown command ${command}`);
}
ws.close();

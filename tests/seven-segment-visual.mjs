import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || path.join(here, "..", "artifacts", "seven-segment-tall");
const baselineFile = path.join(here, "seven-segment-pin-visual-before.json");
const writeBaseline = process.env.WRITE_BASELINE === "1";
fs.mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
const target = targets.find((item) => item.type === "page" && item.url.startsWith("file:"));
if (target === void 0) throw new Error(`No renderer page on debug port ${port}`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
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
  if (result.exceptionDetails !== void 0) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const capture = async (name) => {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(outDir, name);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  return file;
};
const canvasRect = () =>
  evaluate(
    `(()=>{const r=document.querySelector('[data-testid="circuit-canvas"]').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`,
  );
const setViewport = async (scale, center) => {
  const rect = await canvasRect();
  await evaluate(
    `window.__LCD_VIEWPORT_STORE__.getState().setViewport({scale:${scale},offsetX:${rect.width / 2 - center.x * scale},offsetY:${rect.height / 2 - center.y * scale}});true`,
  );
  await wait(350);
};
const singlePart = async () => {
  await evaluate("window.__SEVEN_SEGMENT_TEST_SETUP__({position:{x:300,y:260},color:'red'})");
  const ids = await evaluate("(()=>{const d=window.__LCD_STORE__.getState().document;return {segmentId:d.parts.find(p=>p.type==='seven-segment').id}})()");
  return ids.segmentId;
};
const setBrightness = async (entries) => {
  const brightness = {};
  for (const [partId, segments] of entries)
    for (const segment of segments) brightness[`${partId}:${segment}`] = 1;
  await evaluate(
    `window.__LCD_SIM_STORE__.setState({status:'running',ledBrightness:${JSON.stringify(brightness)}});true`,
  );
  await wait(350);
};
const pinState = async () =>
  evaluate(
    `(()=>{const part=window.__SEVEN_SEGMENT_PIN_DEBUG__()[0];return {position:part.position,pins:part.pins.map(p=>({pinId:p.pinId,x:p.x-part.position.x,y:p.y-part.position.y}))}})()`,
  );

await new Promise((resolve) => (ws.onopen = resolve));
await send("Runtime.enable");
await send("Page.enable");
await evaluate(
  "(()=>{const button=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close');button?.click();return true;})()",
);
await wait(300);

const beforePins = await singlePart();
await setViewport(1, { x: 325, y: 290 });
const geometry = await evaluate("window.__SEVEN_SEGMENT_GEOMETRY__ ?? null");
const pins = await pinState();
if (writeBaseline)
  fs.writeFileSync(baselineFile, JSON.stringify({ pins, geometry }, null, 2));
const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
const pinDiffs = pins.pins.map((pin) => {
  const old = baseline.pins.pins.find((item) => item.pinId === pin.pinId);
  return { pinId: pin.pinId, dx: pin.x - old.x, dy: pin.y - old.y };
});

await setBrightness([[beforePins, ["a", "b", "c", "d", "e", "f", "g", "dp"]]]);
await setViewport(1, { x: 325, y: 290 });
const screenshot100 = await capture("segments-100.png");
await setViewport(4, { x: 325, y: 290 });
const screenshot400 = await capture("segments-400.png");

const digitPatterns = [
  ["a", "b", "c", "d", "e", "f"],
  ["b", "c"],
  ["a", "b", "d", "e", "g"],
  ["a", "b", "c", "d", "g"],
  ["b", "c", "f", "g"],
  ["a", "c", "d", "f", "g"],
  ["a", "c", "d", "e", "f", "g"],
  ["a", "b", "c"],
  ["a", "b", "c", "d", "e", "f", "g"],
  ["a", "b", "c", "d", "f", "g"],
];
await evaluate(
  `(()=>{const state=window.__LCD_STORE__.getState();state.replaceDocument({...state.document,parts:Array.from({length:10},(_,index)=>({id:'digit-'+index,type:'seven-segment',position:{x:70+index*96,y:260},rotation:0,flipX:false,flipY:false,props:{color:'red'}}))});return true;})()`,
);
await wait(350);
await setBrightness(digitPatterns.map((segments, index) => [`digit-${index}`, segments]));
await setViewport(0.85, { x: 562, y: 290 });
const strip = await capture("digits-0-9.png");

const result = {
  geometry,
  pinDiffs,
  pinCoordinatesUnchanged: pinDiffs.every((item) => item.dx === 0 && item.dy === 0),
  screenshot100,
  screenshot400,
  strip,
};
fs.writeFileSync(path.join(outDir, "visual-log.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
ws.close();

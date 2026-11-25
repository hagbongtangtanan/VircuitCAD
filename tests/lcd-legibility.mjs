import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || path.join(here, "..", "artifacts", "lcd-legibility");
const prefix = process.env.PREFIX || "after";
const expect = process.env.LCD_EXPECT || "final";
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
  if (result.exceptionDetails !== void 0) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const snapshot = async (name) => {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(outDir, `${prefix}-${name}`);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  return file;
};
const metrics = () => evaluate("JSON.parse(JSON.stringify(window.__LCD_RENDER_METRICS__ ?? {}))");
const setViewport = async (scale) => {
  await evaluate(`window.__LCD_VIEWPORT_STORE__.getState().setViewport({ scale: ${scale}, offsetX: 80, offsetY: 40 }); true`);
  await wait(350);
};
const setViewportCentered = async (scale) => {
  await evaluate(`(()=>{
    const rect=document.querySelector('canvas').getBoundingClientRect();
    const part=window.__LCD_STORE__.getState().document.parts.find((candidate)=>candidate.type==='lcd-16x2-i2c');
    const centerX=part.position.x+60;
    const centerY=part.position.y+45;
    window.__LCD_VIEWPORT_STORE__.getState().setViewport({
      scale:${scale},
      offsetX:rect.width/2-centerX*${scale},
      offsetY:rect.height/2-centerY*${scale},
    });
    return true;
  })()`);
  await wait(350);
};
const glassBrightPixels = async (scale) => {
  await setViewportCentered(scale);
  return evaluate(`(()=>{
    const vp=window.__LCD_VIEWPORT_STORE__.getState().viewport;
    const part=window.__LCD_STORE__.getState().document.parts.find((candidate)=>candidate.type==='lcd-16x2-i2c');
    const x=Math.round(vp.offsetX+(part.position.x+14)*vp.scale);
    const y=Math.round(vp.offsetY+(part.position.y+23)*vp.scale);
    const w=Math.round(92*vp.scale);
    const h=Math.round(20*vp.scale);
    let best=0;
    for(const canvas of document.querySelectorAll('canvas')){
      const ctx=canvas.getContext('2d');
      const data=ctx.getImageData(x,y,w,h).data;
      let count=0;
      for(let i=0;i<data.length;i+=4){
        const luminance=(data[i]+data[i+1]+data[i+2])/3;
        if(luminance>180)count+=1;
      }
      best=Math.max(best,count);
    }
    return best;
  })()`);
};
const setProps = async (props) => {
  await evaluate(`window.__LCD_TEST_SET_PROPS__(${JSON.stringify(props)}); true`);
  await wait(250);
};
const connectSupply = async () => {
  await evaluate(`(()=>{
    const state=window.__LCD_STORE__.getState();
    const parts=state.document.parts;
    const parallel=parts.find((part)=>part.type==='lcd-16x2');
    const i2c=parts.find((part)=>part.type==='lcd-16x2-i2c');
    state.addWire({partId:parallel.id,pinId:'vdd'},{partId:i2c.id,pinId:'vcc'});
    state.addWire({partId:parallel.id,pinId:'vss'},{partId:i2c.id,pinId:'gnd'});
    return true;
  })()`);
  await wait(250);
};
const setDisplay = async (lines, backlight) => {
  await evaluate(`(()=>{
    const ids=window.__LCD_STORE__.getState().document.parts
      .filter((part)=>part.type==='lcd-16x2'||part.type==='lcd-16x2-i2c')
      .map((part)=>part.id);
    const lcdDisplays={};
    for (const id of ids) lcdDisplays[id]={lines:${JSON.stringify(lines)},backlight:${backlight}};
    window.__LCD_SIM_STORE__.setState({status:'running',lcdDisplays});
    return true;
  })()`);
  await wait(350);
};
const comparePins = (before, after) => {
  const rows = [];
  for (const beforePart of before) {
    const afterPart = after.find((candidate) => candidate.type === beforePart.type);
    for (const beforePin of beforePart.pins) {
      const afterPin = afterPart.pins.find((candidate) => candidate.pinId === beforePin.pinId);
      const dx = afterPin.x - beforePin.x;
      const dy = afterPin.y - beforePin.y;
      rows.push({
        type: beforePart.type,
        pinId: beforePin.pinId,
        before: { x: beforePin.x, y: beforePin.y },
        after: { x: afterPin.x, y: afterPin.y },
        dx,
        dy,
        difference: Math.hypot(dx, dy),
      });
    }
  }
  return { rows, maxDifference: Math.max(...rows.map((row) => row.difference)) };
};

await new Promise((resolve) => (ws.onopen = resolve));
await send("Runtime.enable");
await send("Page.enable");
await evaluate(
  "(()=>{const button=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close');button?.click();return true;})()",
);
await wait(300);
const ids = await evaluate(
  "window.__LCD_TEST_SETUP__({props:{theme:'blue',backlight:true,contrast:0.85}});(()=>{const d=window.__LCD_STORE__.getState().document;return {parallelId:d.parts.find(p=>p.type==='lcd-16x2').id,i2cId:d.parts.find(p=>p.type==='lcd-16x2-i2c').id};})()",
);
await setViewport(1);
await connectSupply();
await evaluate("window.__LCD_SIM_STORE__.setState({status:'stopped',lcdDisplays:{}}); true");
await wait(250);
const idleMetrics = await metrics();

await setDisplay(["Hello, Virtcuit!", "LCD Tutorial"], true);
const mainScreenshot = await snapshot("100.png");
const mainMetrics = await metrics();

await setDisplay(["Hello, Virtcuit!", ""], true);
const emptyScreenshot = await snapshot("empty-row.png");
const emptyMetrics = await metrics();

await setProps({ theme: "green", contrast: 0.85 });
await setDisplay(["Hello, Virtcuit!", "LCD Tutorial"], true);
const greenScreenshot = await snapshot("green.png");
const greenMetrics = await metrics();

await setProps({ theme: "blue", contrast: 0.85 });
await setDisplay(["Hello, Virtcuit!", "LCD Tutorial"], false);
const offScreenshot = await snapshot("backlight-off.png");
const offMetrics = await metrics();

await setProps({ theme: "blue", contrast: 0.2 });
await setDisplay(["Hello, Virtcuit!", "LCD Tutorial"], true);
const lowContrastScreenshot = await snapshot("low-contrast.png");
const lowContrastMetrics = await metrics();

await setProps({ theme: "blue", contrast: 0.85 });
await setDisplay(["Hello, Virtcuit!", "LCD Tutorial"], true);
await setViewport(0.4);
const lowZoomScreenshot = await snapshot("low-zoom.png");
const lowZoomMetrics = await metrics();
await setViewport(1);

const zoomSweep = [];
for (const scale of [0.25, 0.5, 1, 1.5, 2, 2.25, 2.49, 3]) {
  zoomSweep.push({
    scale,
    brightPixels: await glassBrightPixels(scale),
    mode: (await metrics())[ids.i2cId]?.mode ?? null,
  });
}
await setViewport(1);

const pins = comparePins(baseline, await evaluate("JSON.parse(JSON.stringify(window.__LCD_PIN_DEBUG__()))"));
await evaluate(`window.__LCD_STORE__.getState().selectParts([${JSON.stringify(ids.parallelId)},${JSON.stringify(ids.i2cId)}]); true`);
await evaluate("window.__LCD_STORE__.getState().flipSelected('horizontal'); true");
await wait(350);
const flipHScreenshot = await snapshot("flip-horizontal.png");
const flipHMetrics = await metrics();
await evaluate("window.__LCD_STORE__.getState().flipSelected('vertical'); true");
await wait(350);
const flipVScreenshot = await snapshot("flip-vertical.png");
const flipVMetrics = await metrics();

const disconnectedIds = await evaluate(
  "window.__LCD_TEST_SETUP__({props:{theme:'blue',backlight:true,contrast:0.85}});(()=>{const d=window.__LCD_STORE__.getState().document;return {parallelId:d.parts.find(p=>p.type==='lcd-16x2').id,i2cId:d.parts.find(p=>p.type==='lcd-16x2-i2c').id};})()",
);
await setDisplay(["Hello, Virtcuit!", "LCD Tutorial"], true);
const disconnectedMetrics = await metrics();

const sample = mainMetrics[ids.i2cId] ?? mainMetrics[ids.parallelId] ?? null;
const finalChecks = {
  fillRatio: sample?.fillRatio >= 0.88 && sample.fillRatio <= 0.92,
  margins:
    sample?.glassMargin?.xRatio >= 0.04 &&
    sample.glassMargin.xRatio <= 0.06 &&
    sample.glassMargin.yRatio >= 0.04 &&
    sample.glassMargin.yRatio <= 0.06,
  contrastRatio: sample?.contrastRatio >= 7,
  unlitOpacity: sample?.unlitOpacity >= 0.04 && sample.unlitOpacity <= 0.06,
  unlitHiddenAtLowContrast: lowContrastMetrics[ids.i2cId]?.unlitDrawn === false,
  lowZoomBlocks: lowZoomMetrics[ids.i2cId]?.mode === "blocks",
  zoomVisible: zoomSweep.every((entry) => entry.brightPixels > 0),
  greenTheme: greenMetrics[ids.i2cId]?.theme === "green",
  backlightOff: offMetrics[ids.i2cId]?.backlight === false,
  supplyConnectsBacklight: mainMetrics[ids.i2cId]?.powerConnected === true,
  disconnectedBacklightOff:
    disconnectedMetrics[disconnectedIds.i2cId]?.powerConnected === false &&
    disconnectedMetrics[disconnectedIds.i2cId]?.backlight === false &&
    disconnectedMetrics[disconnectedIds.i2cId]?.litColor === offMetrics[ids.i2cId]?.litColor,
  idleBacklightOff: idleMetrics[ids.i2cId]?.backlight === false,
  backlightVisuallyDims:
    mainMetrics[ids.i2cId]?.litColor !== offMetrics[ids.i2cId]?.litColor &&
    mainMetrics[ids.i2cId]?.backlightFactor === 1 &&
    offMetrics[ids.i2cId]?.backlightFactor < 0.2,
  flipReadable:
    flipHMetrics[ids.i2cId]?.lines?.[0] === "Hello, Virtcuit!" &&
    flipVMetrics[ids.i2cId]?.lines?.[0] === "Hello, Virtcuit!",
  pins: pins.maxDifference === 0,
  consoleErrors: consoleErrors.length === 0,
};
const result = {
  prefix,
  ids,
  screenshot: mainScreenshot,
  screenshots: {
    main: mainScreenshot,
    emptyRow: emptyScreenshot,
    green: greenScreenshot,
    backlightOff: offScreenshot,
    lowContrast: lowContrastScreenshot,
    lowZoom: lowZoomScreenshot,
    flipHorizontal: flipHScreenshot,
    flipVertical: flipVScreenshot,
  },
  metrics: {
    idle: idleMetrics,
    main: mainMetrics,
    emptyRow: emptyMetrics,
    green: greenMetrics,
    backlightOff: offMetrics,
    lowContrast: lowContrastMetrics,
    lowZoom: lowZoomMetrics,
    flipHorizontal: flipHMetrics,
    flipVertical: flipVMetrics,
    disconnected: disconnectedMetrics,
  },
  zoomSweep,
  pins,
  consoleErrors,
  checks: finalChecks,
  pass: expect === "baseline" || Object.values(finalChecks).every(Boolean),
};
const logFile = path.join(outDir, `${prefix}-acceptance.json`);
fs.writeFileSync(logFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, logFile }, null, 2));
ws.close();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const command = process.argv[2] || "light";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || path.join(here, "..", "artifacts", "light-theme");
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
const dismissTour = async () => {
  await evaluate(
    "(()=>{const b=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close');b?.click();return true})()",
  );
  await wait(250);
};
const waitForApp = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate(
      `!!document.querySelector('[data-testid="circuit-canvas"]')`,
    );
    if (ready === true) break;
    await wait(100);
  }
  await dismissTour();
};
const setTheme = async (theme) => {
  await evaluate(
    `(()=>{localStorage.setItem('vircuitcad.theme',${JSON.stringify(theme)});return true})()`,
  );
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  return evaluate(`document.documentElement.dataset.theme`);
};
const loadStarter = async () => {
  await evaluate(
    `(()=>{document.querySelector('[data-testid="samples-toggle"]')?.click();return true})()`,
  );
  await wait(250);
  await evaluate(
    `(()=>{document.querySelector('[data-testid="starter-card-uno-lcd-hello"]')?.click();return true})()`,
  );
  await wait(500);
};
const setMedia = async (features) => {
  await send("Emulation.setEmulatedMedia", { features });
  await wait(350);
};
const keyTab = async () => {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
  });
  await wait(120);
};

await send("Runtime.enable");
await send("Page.enable");

if (command === "compare") {
  const before = process.argv[3];
  const after = process.argv[4];
  if (!before || !after) throw new Error("compare requires before and after PNG paths");
  await waitForApp();
  const diff = await evaluate(`(async()=>{
    const load=(src)=>new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('Unable to load '+src));
      image.src=src;
    });
    const [first,second]=await Promise.all([
      load(${JSON.stringify("file://" + path.resolve(before))}),
      load(${JSON.stringify("file://" + path.resolve(after))}),
    ]);
    if(first.width!==second.width||first.height!==second.height)
      return {sameSize:false,first:{width:first.width,height:first.height},second:{width:second.width,height:second.height}};
    const canvas=document.createElement('canvas');
    canvas.width=first.width;
    canvas.height=first.height;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(first,0,0);
    const a=context.getImageData(0,0,canvas.width,canvas.height).data;
    context.clearRect(0,0,canvas.width,canvas.height);
    context.drawImage(second,0,0);
    const b=context.getImageData(0,0,canvas.width,canvas.height).data;
    let changed=0,maxChannel=0,total=0;
    for(let index=0;index<a.length;index+=4){
      let pixelChanged=false;
      for(let channel=0;channel<4;channel+=1){
        const delta=Math.abs(a[index+channel]-b[index+channel]);
        total+=delta;
        maxChannel=Math.max(maxChannel,delta);
        if(delta!==0)pixelChanged=true;
      }
      if(pixelChanged)changed+=1;
    }
    return {sameSize:true,width:canvas.width,height:canvas.height,changedPixels:changed,maxChannelDelta:maxChannel,meanChannelDelta:Number((total/a.length).toFixed(6))};
  })()`);
  const result = { before, after, diff, pass: diff.sameSize === true && diff.changedPixels === 0, consoleErrors };
  const file = path.join(outDir, "dark-theme-diff.json");
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, file }, null, 2));
  ws.close();
  process.exit(0);
}

if (command === "dark") {
  const theme = await setTheme("dark");
  await loadStarter();
  const screenshot = await snapshot("dark-theme.png");
  const result = { command, theme, screenshot, consoleErrors };
  const file = path.join(outDir, "dark-theme-capture.json");
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, file }, null, 2));
  ws.close();
  process.exit(0);
}

const theme = await setTheme("light");
await loadStarter();
const screenshots = {};
screenshots.light100 = await snapshot("light-100.png");

const viewport = await evaluate(`({width:innerWidth,height:innerHeight})`);
await send("Emulation.setDeviceMetricsOverride", {
  width: viewport.width,
  height: viewport.height,
  deviceScaleFactor: 2,
  mobile: false,
});
await wait(400);
screenshots.light200 = await snapshot("light-200.png");
await send("Emulation.clearDeviceMetricsOverride");
await wait(250);

let browserZoom = { supported: true, method: "Emulation.setPageScaleFactor" };
try {
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await wait(400);
  screenshots.lightBrowserZoom200 = await snapshot("light-browser-zoom-200.png");
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
} catch (error) {
  browserZoom = { supported: false, method: "documentElement.zoom", error: String(error) };
  await evaluate("document.documentElement.style.zoom='2'; true");
  await wait(400);
  screenshots.lightBrowserZoom200 = await snapshot("light-browser-zoom-200.png");
  await evaluate("document.documentElement.style.zoom=''; true");
}
await wait(250);

const palette = await evaluate(`(()=>{
  const state=window.__LCD_STORE__.getState();
  const wire=state.document.wires[0];
  if(!wire)return {ok:false};
  state.selectWire(wire.id);
  const style=getComputedStyle(document.documentElement);
  return {
    ok:true,
    wireId:wire.id,
    colors:{
      positive:style.getPropertyValue('--cb-wire-positive').trim(),
      ground:style.getPropertyValue('--cb-wire-ground').trim(),
      signal:style.getPropertyValue('--cb-wire-signal').trim(),
      signalBlue:style.getPropertyValue('--cb-wire-signal-blue').trim(),
      signalIce:style.getPropertyValue('--cb-wire-signal-ice').trim(),
      ink:style.getPropertyValue('--cb-wire-ink').trim(),
    },
  };
})()`);

const wireShots = [];
for (const [name, value] of Object.entries(palette.colors ?? {})) {
  await evaluate(
    `(()=>{const s=window.__LCD_STORE__.getState();s.setWireColor(${JSON.stringify(
      {
        positive: "#ffc928",
        ground: "#2f7df6",
        signal: "#6fb3ff",
        signalBlue: "#2e78c7",
        signalIce: "#b9d9ff",
        ink: "#101a27",
      }[name],
    )});return true})()`,
  );
  await wait(300);
  wireShots.push({
    name,
    canonical: {
      positive: "#ffc928",
      ground: "#2f7df6",
      signal: "#6fb3ff",
      signalBlue: "#2e78c7",
      signalIce: "#b9d9ff",
      ink: "#101a27",
    }[name],
    display: value,
    screenshot: await snapshot(`light-wire-${name}.png`),
  });
}

await evaluate(`(()=>{document.activeElement?.blur?.();return true})()`);
const focus = [];
for (let index = 1; index <= 5; index += 1) {
  await keyTab();
  const active = await evaluate(`(()=>{
    const element=document.activeElement;
    return {
      tag:element?.tagName??null,
      className:typeof element?.className==='string'?element.className:null,
      testId:element?.getAttribute?.('data-testid')??null,
      text:(element?.innerText??'').slice(0,40),
    };
  })()`);
  focus.push({ index, active, screenshot: await snapshot(`light-focus-${index}.png`) });
}

await setMedia([{ name: "prefers-contrast", value: "more" }]);
screenshots.moreContrast = await snapshot("light-more-contrast.png");
await setMedia([]);
let forcedColors = { supported: true };
try {
  await setMedia([{ name: "forced-colors", value: "active" }]);
  screenshots.forcedColors = await snapshot("light-forced-colors.png");
  await setMedia([]);
} catch (error) {
  forcedColors = { supported: false, error: String(error) };
}

const result = {
  command,
  theme,
  screenshots,
  palette,
  wireShots,
  focus,
  forcedColors,
  browserZoom,
  consoleErrors,
  pass: theme === "light" && palette.ok === true && consoleErrors.length === 0,
};
const file = path.join(outDir, "light-theme-screenshots.json");
fs.writeFileSync(file, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, file }, null, 2));
ws.close();

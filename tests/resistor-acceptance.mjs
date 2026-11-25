import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || path.join(here, "..", "artifacts", "resistor");
const bundlePath = path.join(
  here,
  "..",
  "recovered-src",
  "out",
  "renderer",
  "assets",
  "index-N0START1.js",
);
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
const screenshot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(outDir, name);
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  return file;
};

const sceneExpr = `(() => {
  const el=document.querySelector('[data-testid="circuit-canvas"]');
  const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));
  let root=el[key]; while(root.return)root=root.return;
  let stageNode=null;
  const find=node=>{if(!node||stageNode)return;if(typeof node.elementType==='function'&&node.elementType.name==='StageWrap'){stageNode=node;return;}find(node.child);find(node.sibling);};
  find(root);
  let hook=stageNode?.memoizedState;
  while(hook&&hook.memoizedState&&!hook.memoizedState.current?.getLayers)hook=hook.next;
  const layers=hook?.memoizedState?.current?.getLayers?.()??[];
  const layer=layers[0];
  const rect=el.getBoundingClientRect();
  const previews=[],valueLabels=[];
  const walk=node=>{if(!node)return;
    if(node.className==='Circle'&&typeof node.stroke==='function'){
      const stroke=String(node.stroke()||'').toLowerCase();
      if(stroke==='#ff4d4f'||stroke==='#3ddc84')previews.push({x:node.x(),y:node.y(),stroke});
    }
    if(node.className==='Text'&&typeof node.text==='function'&&typeof node.getAbsoluteTransform==='function'){
      const text=node.text();
      if(typeof text==='string'&&text.includes('ohm')){
        const matrix=node.getAbsoluteTransform().m;
        valueLabels.push({text,scaleX:matrix[0],scaleY:matrix[3]});
      }
    }
    for(const child of node.getChildren?.()||[])walk(child);
  };
  for(const candidate of layers)candidate?.getChildren?.().forEach(walk);
  return JSON.stringify({rect:{left:rect.left,top:rect.top},layer:{x:layer?.x()??0,y:layer?.y()??0,scaleX:layer?.scaleX()??1},previews,valueLabels});
})()`;
const snapshot = async () => JSON.parse(await evaluate(sceneExpr));
const resistorDebug = async () => evaluate("JSON.parse(JSON.stringify(window.__RESISTOR_DEBUG__()))");
const alignmentDebug = async () =>
  evaluate("JSON.parse(JSON.stringify(window.__RESISTOR_ALIGNMENT_DEBUG__ ?? null))");
const renderMetrics = async () =>
  evaluate("JSON.parse(JSON.stringify(window.__RESISTOR_RENDER_METRICS__ ?? {}))");
const wireEndpoints = async () =>
  evaluate("JSON.parse(JSON.stringify(window.__RESISTOR_WIRE_ENDPOINTS__()))");
const wireCount = async () =>
  evaluate("window.__LCD_STORE__.getState().document.wires.length");
const toPage = (point, snap) => ({
  x: snap.rect.left + snap.layer.x + point.x * snap.layer.scaleX,
  y: snap.rect.top + snap.layer.y + point.y * snap.layer.scaleX,
});
const mouse = (type, point, buttons = 0) =>
  send("Input.dispatchMouseEvent", {
    type,
    x: point.x,
    y: point.y,
    button: type === "mouseReleased" || buttons ? "left" : "none",
    buttons,
    clickCount: 1,
  });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cancelRouting = async () => {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await wait(50);
};

async function setup({ position = { x: 520, y: 300 }, resistanceOhms = 220 } = {}) {
  const ids = await evaluate(
    `window.__RESISTOR_TEST_SETUP__({position:${JSON.stringify(position)},resistanceOhms:${resistanceOhms}})`,
  );
  await evaluate(
    "window.__LCD_VIEWPORT_STORE__.getState().setViewport({scale:1.2,offsetX:40,offsetY:40});true",
  );
  await cancelRouting();
  await wait(300);
  return ids;
}

async function setViewportCentered(scale, center) {
  const rect = await evaluate(
    `(()=>{const r=document.querySelector('[data-testid="circuit-canvas"]').getBoundingClientRect();return {width:r.width,height:r.height}})()`,
  );
  await evaluate(
    `window.__LCD_VIEWPORT_STORE__.getState().setViewport({scale:${scale},offsetX:${rect.width / 2 - center.x * scale},offsetY:${rect.height / 2 - center.y * scale}});true`,
  );
  await wait(350);
}

async function dragPart(fromWorld, targetWorld) {
  const snap = await snapshot();
  const from = toPage(fromWorld, snap);
  const target = toPage(targetWorld, snap);
  await mouse("mouseMoved", from);
  await mouse("mousePressed", from, 1);
  let preview = [];
  for (let step = 1; step <= 14; step += 1) {
    const point = {
      x: from.x + ((target.x - from.x) * step) / 14,
      y: from.y + ((target.y - from.y) * step) / 14,
    };
    await mouse("mouseMoved", point, 1);
    await wait(35);
    const current = await snapshot();
    if (current.previews.length > 0) preview = current.previews;
  }
  await mouse("mouseReleased", target);
  await wait(400);
  return preview;
}

const boardHole = (column, rowY) => ({ x: 30 + (column - 1) * 10, y: rowY });
const resistorCenter = (part) => ({ x: part.position.x + 20, y: part.position.y + 10 });
const nearestHole = (point) => {
  let best = null;
  for (const rowY of [70, 80, 90, 100, 110, 130, 140, 150, 160, 170])
    for (let column = 1; column <= 45; column += 1) {
      const hole = boardHole(column, rowY);
      const d = distance(point, hole);
      if (best === null || d < best.distance) best = { hole, distance: d };
    }
  return best;
};

async function validDrop(column, rowY = 150) {
  await setup();
  const before = await resistorDebug();
  const part = before.parts[0];
  const firstHole = boardHole(column, rowY);
  const topLeft = { x: firstHole.x, y: rowY - 10 };
  const preview = await dragPart(resistorCenter(part), {
    x: topLeft.x + 20,
    y: topLeft.y + 10,
  });
  const report = await alignmentDebug();
  const after = await resistorDebug();
  const pins = after.parts[0].pins;
  const pinRows = pins.map((pin) => report?.pins?.find((entry) => entry.pinId === pin.pinId));
  return {
    column,
    rowY,
    partId: after.parts[0].partId,
    preview,
    report,
    pins,
    printed: pinRows.map((entry) => entry?.printedLabel ?? null),
    distances: pinRows.map((entry) => entry?.distance ?? null),
    wireCount: await wireCount(),
  };
}

await new Promise((resolve) => (ws.onopen = resolve));
await send("Runtime.enable");
await send("Page.enable");
await evaluate(
  "(()=>{const b=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close')||[...document.querySelectorAll('.cb-tour-card button')].find(item=>/already know/i.test(item.textContent||''));b?.click();return Boolean(b);})()",
);
await wait(300);

const bundleSource = fs.readFileSync(bundlePath, "utf8");
const resistorDefinitionSource = bundleSource.slice(
  bundleSource.indexOf("var resistorDefinition = {"),
  bundleSource.indexOf("var jumperWireDefinition = {"),
);
const singleSourceSpan = {
  constant: /var RESISTOR_SPAN_PITCHES = 4;/.test(bundleSource),
  definitionUsesConstant: /width: RESISTOR_SPAN_PITCHES \* BREADBOARD_COLUMN_PITCH/.test(
    resistorDefinitionSource,
  ),
  validatorUsesConstant: /Math\.abs\(first\.identity\.column - second\.identity\.column\) ===\s*RESISTOR_SPAN_PITCHES/.test(
    bundleSource,
  ),
  noHardcodedDefinitionWidth40: !/width:\s*40\s*,/.test(resistorDefinitionSource),
};
singleSourceSpan.pass = Object.values(singleSourceSpan).every(Boolean);

const debug = await (async () => {
  await setup();
  await wait(200);
  return resistorDebug();
})();
const oldVsNew = [
  {
    pinId: "lead1",
    label: "1",
    old: { x: 0, y: 10, pitchSpan: 3 },
    new: debug.definition.pins[0].position,
  },
  {
    pinId: "lead2",
    label: "2",
    old: { x: 30, y: 10, pitchSpan: 3 },
    new: debug.definition.pins[1].position,
  },
];

const drops = [];
for (const column of [3, 8, 15, 22, 35]) drops.push(await validDrop(column));

const zoomDrop = await validDrop(15);
await setViewportCentered(1, { x: 70, y: 150 });
const zoom100 = await screenshot("resistor-100.png");
await setViewportCentered(4, { x: 70, y: 150 });
const zoom400 = await screenshot("resistor-400.png");
await setViewportCentered(1.2, { x: 70, y: 150 });
const bodyMetrics = (await renderMetrics())[zoomDrop.partId] ?? null;

const expectedBands = {
  220: ["red", "red", "brown", "gold"],
  1000: ["brown", "black", "red", "gold"],
  4700: ["yellow", "violet", "red", "gold"],
  10000: ["brown", "black", "orange", "gold"],
  100000: ["brown", "black", "yellow", "gold"],
  1000000: ["brown", "black", "green", "gold"],
};
const bandTable = debug.bands.map((band) => ({
  value: band.value,
  names: band.names,
  colors: band.colors,
  expected: expectedBands[band.value],
  match: JSON.stringify(band.names) === JSON.stringify(expectedBands[band.value]),
}));

const occupiedIds = await setup();
const occupied = await (async () => {
  await evaluate(
    "window.__LCD_STORE__.getState().addPart('resistor',{x:50,y:140});true",
  );
  const before = await resistorDebug();
  const dragging = before.parts.find(
    (candidate) => candidate.partId === occupiedIds.resistorId,
  );
  const preview = await dragPart(resistorCenter(dragging), { x: 70, y: 150 });
  return {
    preview,
    report: await alignmentDebug(),
    wireCount: await wireCount(),
  };
})();

await setup();
await evaluate("(()=>{const s=window.__LCD_STORE__.getState();s.selectParts(s.document.parts.filter(p=>p.type==='resistor').map(p=>p.id));s.rotateSelected();return true;})()");
await wait(250);
const sameStrip = await (async () => {
  const before = await resistorDebug();
  const part = before.parts[0];
  const preview = await dragPart(resistorCenter(part), { x: 30, y: 90 });
  return {
    preview,
    report: await alignmentDebug(),
    wireCount: await wireCount(),
  };
})();

await setup();
const offBoard = await (async () => {
  const before = await resistorDebug();
  const part = before.parts[0];
  const preview = await dragPart(resistorCenter(part), { x: 500, y: 400 });
  return {
    preview,
    report: await alignmentDebug(),
    wireCount: await wireCount(),
  };
})();

const transformDrop = await validDrop(3);
const transformPart = transformDrop.pins[0];
void transformPart;
const wireEndpointsBefore = await wireEndpoints();
await evaluate("(()=>{const s=window.__LCD_STORE__.getState();s.selectParts(s.document.parts.filter(p=>p.type==='resistor').map(p=>p.id));s.rotateSelected();return true;})()");
await wait(300);
const rotated = await resistorDebug();
const rotatedHoles = rotated.parts[0].pins.map((pin) => nearestHole(pin));
const rotatedScene = await snapshot();
await evaluate("(()=>{const s=window.__LCD_STORE__.getState();s.selectParts(s.document.parts.filter(p=>p.type==='resistor').map(p=>p.id));s.flipSelected('horizontal');return true;})()");
await wait(300);
const flipped = await resistorDebug();
const flippedHoles = flipped.parts[0].pins.map((pin) => nearestHole(pin));
const wireEndpointsAfter = await wireEndpoints();
const wireFollows = wireEndpointsAfter.every((wire) => {
  const ends = [wire.from, wire.to].filter(
    (end) => end.partId === flipped.parts[0].partId,
  );
  return ends.every((end) => {
    const pin = flipped.parts[0].pins.find((candidate) => candidate.pinId === end.pinId);
    return pin !== void 0 && distance(end.world, pin) < 0.01;
  });
});

const previewHas = (entry, color) =>
  entry.preview.some((preview) => preview.stroke === color);
const checks = {
  singleSourceSpan: singleSourceSpan.pass,
  oldPinIdsPreserved:
    debug.definition.pins.map((pin) => pin.id).join(",") === "lead1,lead2",
  spanIsFourPitches:
    Math.abs(debug.definition.pins[1].position.x - debug.definition.pins[0].position.x - 40) < 0.01,
  fiveDrops:
    drops.length === 5 &&
    drops.every(
      (drop) =>
        drop.report?.valid === true &&
        drop.distances.every((value) => value !== null && value < 0.01) &&
        drop.printed.every((label) => label !== null && label.column !== void 0) &&
        Math.abs(drop.pins[1].x - drop.pins[0].x - 40) < 0.01 &&
        Math.abs(drop.pins[1].y - drop.pins[0].y) < 0.01,
    ),
  greenValidPreview: drops.some((drop) => previewHas(drop, "#3ddc84")),
  bodyClearsNeighborHoles:
    bodyMetrics !== null &&
    bodyMetrics.clearance.above > 0 &&
    bodyMetrics.clearance.below > 0,
  bandTable: bandTable.every((band) => band.match),
  occupiedRejected:
    previewHas(occupied, "#ff4d4f") &&
    occupied.report?.valid === false &&
    occupied.wireCount === 0,
  sameStripRejected:
    previewHas(sameStrip, "#ff4d4f") &&
    sameStrip.report?.valid === false &&
    sameStrip.wireCount === 0,
  offBoardRejected:
    previewHas(offBoard, "#ff4d4f") &&
    offBoard.report?.valid === false &&
    offBoard.wireCount === 0,
  rotationKeepsAnchors:
    rotatedHoles.every((entry) => entry.distance < 0.01),
  flipKeepsAnchors: flippedHoles.every((entry) => entry.distance < 0.01),
  labelsReadable:
    rotatedScene.valueLabels.length > 0 &&
    rotatedScene.valueLabels.every(
      (label) => label.scaleX > 0 && label.scaleY > 0,
    ),
  wireFollowsPins: wireEndpointsBefore.length > 0 && wireFollows,
  consoleErrors: consoleErrors.length === 0,
};

const result = {
  oldVsNew,
  constants: debug.constants,
  definition: debug.definition,
  singleSourceSpan,
  drops,
  bodyMetrics,
  bandTable,
  invalid: { occupied, sameStrip, offBoard },
  transform: {
    rotatedPins: rotated.parts[0].pins,
    rotatedHoleDistances: rotatedHoles,
    flippedPins: flipped.parts[0].pins,
    flippedHoleDistances: flippedHoles,
    valueLabels: rotatedScene.valueLabels,
    wireEndpointsBefore,
    wireEndpointsAfter,
  },
  screenshots: { zoom100, zoom400 },
  consoleErrors,
  checks,
  pass: Object.values(checks).every(Boolean),
};
const logFile = path.join(outDir, "acceptance-log.json");
fs.writeFileSync(logFile, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      pass: result.pass,
      checks,
      oldVsNew,
      printedColumns: drops.map((drop) => ({
        column: drop.column,
        pins: drop.printed.map((label) =>
          label === null ? null : `${label.row}${label.column}`,
        ),
        distances: drop.distances,
      })),
      bodyEdges: bodyMetrics,
      bandTable,
      screenshots: result.screenshots,
      logFile,
    },
    null,
    2,
  ),
);
ws.close();

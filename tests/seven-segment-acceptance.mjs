import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9334";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || path.join(here, "..", "artifacts", "seven-segment");
fs.mkdirSync(outDir, { recursive: true });
const baseline = JSON.parse(
  fs.readFileSync(path.join(here, "seven-segment-pin-before.json"), "utf8"),
)[0];

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
  const previews=[],labels=[],segments=[],dots=[],chips=[],padRings=[];
  const walk=node=>{if(!node)return;
    if(node.className==='Circle'&&typeof node.stroke==='function'){
      const stroke=String(node.stroke()||'').toLowerCase();
      if(stroke==='#ff4d4f'||stroke==='#3ddc84')previews.push({x:node.x(),y:node.y(),stroke});
      if(stroke==='#8b95a5')padRings.push({x:node.x(),y:node.y(),radius:node.radius()});
    }
    if(node.className==='Rect'&&typeof node.fill==='function'){
      const fill=String(node.fill()||'').toLowerCase();
      const width=typeof node.width==='function'?node.width():0;
      const height=typeof node.height==='function'?node.height():0;
      if(fill==='#0b0d12'&&width<20&&height<20)chips.push({x:node.x(),y:node.y(),width,height,rotation:node.rotation()});
    }
    if(node.className==='Circle'&&typeof node.fill==='function'){
      const fill=String(node.fill()||'').toLowerCase();
      if(fill==='#3a3d43'||fill==='#e5484d')dots.push({fill,x:node.x(),y:node.y()});
    }
    if(node.className==='Line'&&typeof node.closed==='function'&&node.closed()){
      const fill=typeof node.fill==='function'?String(node.fill()||'').toLowerCase():'';
      if(fill==='#3a3d43'||fill==='#e5484d'){
        const points=typeof node.points==='function'?node.points():[];
        segments.push({fill,pointCount:points.length});
      }
    }
    if(node.className==='Text'&&typeof node.text==='function'&&typeof node.getAbsoluteTransform==='function'){
      const text=node.text();
      if(['A','B','C','D','E','F','G','DP','CC'].includes(text)){
        const matrix=node.getAbsoluteTransform().m;
        labels.push({text,x:node.x(),y:node.y(),width:node.width(),height:node.height(),scaleX:matrix[0],scaleY:matrix[3]});
      }
    }
    for(const child of node.getChildren?.()||[])walk(child);
  };
  for(const candidate of layers)candidate?.getChildren?.().forEach(walk);
  return JSON.stringify({rect:{left:rect.left,top:rect.top},layer:{x:layer?.x()??0,y:layer?.y()??0,scaleX:layer?.scaleX()??1},previews,labels,segments,dots,chips,padRings});
})()`;
const snapshot = async () => JSON.parse(await evaluate(sceneExpr));
const pinDebug = async () => evaluate("window.__SEVEN_SEGMENT_PIN_DEBUG__()");
const alignmentDebug = async () => evaluate("window.__SEVEN_SEGMENT_ALIGNMENT_DEBUG__ ?? null");
const renderMetrics = async () => evaluate("JSON.parse(JSON.stringify(window.__SEVEN_SEGMENT_RENDER_METRICS__ ?? {}))");
const wireEndpoints = async () => evaluate("window.__SEVEN_SEGMENT_WIRE_ENDPOINTS__()");
const wireCount = async () => evaluate("window.__LCD_STORE__.getState().document.wires.length");
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

async function setup({ position = { x: 260, y: 260 }, color = "red" } = {}) {
  const ids = await evaluate(
    `window.__SEVEN_SEGMENT_TEST_SETUP__({position:${JSON.stringify(position)},color:${JSON.stringify(color)}})`,
  );
  await evaluate(
    "window.__LCD_VIEWPORT_STORE__.getState().setViewport({scale:1.2,offsetX:40,offsetY:40});true",
  );
  await wait(350);
  return ids;
}

async function dragPart(fromWorld, targetWorld) {
  const snap = await snapshot();
  const from = toPage(fromWorld, snap);
  const target = toPage(targetWorld, snap);
  await mouse("mouseMoved", from);
  await mouse("mousePressed", from, 1);
  let preview = [];
  for (let step = 1; step <= 12; step += 1) {
    const point = {
      x: from.x + ((target.x - from.x) * step) / 12,
      y: from.y + ((target.y - from.y) * step) / 12,
    };
    await mouse("mouseMoved", point, 1);
    await wait(30);
    const current = await snapshot();
    if (current.previews.length > 0) preview = current.previews;
  }
  await mouse("mouseReleased", target);
  await wait(400);
  return preview;
}

const boardHole = (column, rowY) => ({ x: 30 + (column - 1) * 10, y: rowY });
const centerForTopLeft = (topLeft) => ({ x: topLeft.x + 25, y: topLeft.y + 30 });

await new Promise((resolve) => (ws.onopen = resolve));
await send("Runtime.enable");
await send("Page.enable");
await evaluate(
  "(()=>{const button=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close');button?.click();return true;})()",
);
await wait(300);

const firstIds = await setup();
const firstPart = (await pinDebug()).find((part) => part.partId === firstIds.segmentId);
const firstScene = await snapshot();
const geometry = await evaluate(
  "JSON.parse(JSON.stringify(window.__SEVEN_SEGMENT_GEOMETRY__ ?? null))",
);
const renderedSegments = firstScene.segments;
const oldById = new Map(baseline.pins.map((pin) => [pin.pinId, pin]));
const pinTable = firstPart.pins.map((pin) => {
  const old = oldById.get(pin.pinId);
  return {
    pinId: pin.pinId,
    oldLabel: old?.label ?? null,
    newLabel: pin.label,
    old: { x: old?.x ?? null, y: old?.y ?? null },
    new: { x: pin.x - firstPart.position.x, y: pin.y - firstPart.position.y },
  };
});
const topPins = pinTable.filter((pin) => pin.new.y === 0);
const bottomPins = pinTable.filter((pin) => pin.new.y === 60);
const spacing = {
  pitch: topPins[1].new.x - topPins[0].new.x,
  rowGap: bottomPins[0].new.y - topPins[0].new.y,
  topX: topPins.map((pin) => pin.new.x),
  bottomX: bottomPins.map((pin) => pin.new.x),
};
const topRingY = Math.min(...firstScene.padRings.map((ring) => ring.y));
const bottomRingY = Math.max(...firstScene.padRings.map((ring) => ring.y));
const maxGapError = (table) =>
  Math.max(0, ...Object.values(table ?? {}).map((value) => Math.abs(value - 0.08)));
const slantMinusSix = await evaluate(
  "window.__SEVEN_SEGMENT_SET_SLANT__(-6);JSON.parse(JSON.stringify(window.__SEVEN_SEGMENT_GEOMETRY__))",
);
const slantZero = await evaluate(
  "window.__SEVEN_SEGMENT_SET_SLANT__(0);JSON.parse(JSON.stringify(window.__SEVEN_SEGMENT_GEOMETRY__))",
);
const visual = {
  body: geometry?.body ?? null,
  digitArea: geometry?.digitArea ?? null,
  segmentBounds: geometry?.segmentBounds ?? null,
  thicknessPitch: geometry?.thicknessPitch ?? null,
  gapPitch: geometry?.gapPitch ?? null,
  horizontalLengthPitch: geometry?.horizontalLengthPitch ?? null,
  verticalLengthPitch: geometry?.verticalLengthPitch ?? null,
  bevelPitch: geometry?.bevelPitch ?? null,
  verticalAspect: geometry?.verticalAspect ?? null,
  slantDeg: geometry?.slantDeg ?? null,
  dpRadiusPitch: geometry?.dp?.radius / spacing.pitch ?? null,
  digitTop: geometry?.digitTop ?? null,
  digitBottom: geometry?.digitBottom ?? null,
  digitWidth: geometry?.digitWidth ?? null,
  digitHeight: geometry?.digitHeight ?? null,
  neighborGaps: geometry?.neighborGaps ?? null,
  renderedNeighborGaps: geometry?.renderedNeighborGaps ?? null,
  maxGapError: maxGapError(geometry?.neighborGaps),
  maxRenderedGapError: maxGapError(geometry?.renderedNeighborGaps),
  topIdleClearance: geometry?.topIdleClearance ?? null,
  topActiveClearance: geometry?.topActiveClearance ?? null,
  bottomIdleClearance: geometry?.bottomIdleClearance ?? null,
  bottomActiveClearance: geometry?.bottomActiveClearance ?? null,
  dpPinClearance: geometry?.dpPinClearance ?? null,
  dpSegmentClearance: geometry?.dpSegmentClearance ?? null,
  bodyOverhangTop: geometry?.bodyOverhangTop ?? null,
  bodyOverhangBottom: geometry?.bodyOverhangBottom ?? null,
  adjacentHoles: geometry?.adjacentHoles ?? null,
  padRings: firstScene.padRings.length,
  idleRingPitch:
    Math.min(...firstScene.padRings.map((ring) => ring.radius)) *
    firstScene.layer.scaleX /
    spacing.pitch,
  labelChips: firstScene.chips.length,
  chipsUpright: firstScene.chips.every((chip) => chip.rotation === 0),
  labelsOutsideBody:
    firstScene.chips.length === 10 &&
    firstScene.chips
      .filter((chip) => chip.y < (topRingY + bottomRingY) / 2)
      .every((chip) => chip.y + chip.height <= topRingY - 5 + 1.5) &&
    firstScene.chips
      .filter((chip) => chip.y >= (topRingY + bottomRingY) / 2)
      .every((chip) => chip.y >= bottomRingY + 5 - 1.5),
  slantSwitch: {
    minusSix: slantMinusSix.slantDeg,
    backToZero: slantZero.slantDeg,
    maxGapErrorMinusSix: maxGapError(slantMinusSix.neighborGaps),
    maxGapErrorBackToZero: maxGapError(slantZero.neighborGaps),
  },
};

const drops = [];
for (const column of [5, 11, 17, 24, 33]) {
  const ids = await setup();
  const part = (await pinDebug()).find((item) => item.partId === ids.segmentId);
  const from = centerForTopLeft(part.position);
  const topLeft = { x: boardHole(column, 90).x - 5, y: 90 };
  const preview = await dragPart(from, centerForTopLeft(topLeft));
  const report = await alignmentDebug();
  const rows = report.pins.map((pin) => pin.printedLabel?.row ?? null);
  const columns = report.pins.map((pin) => pin.printedLabel?.column ?? null);
  drops.push({
    column,
    valid: report.valid,
    previewStroke: preview.at(-1)?.stroke ?? null,
    maxDistance: Math.max(...report.pins.map((pin) => pin.distance)),
    rows,
    columns,
    pins: report.pins.map((pin) => ({
      pinId: pin.pinId,
      hole: pin.printedLabel?.label ?? null,
      row: pin.printedLabel?.row ?? null,
      column: pin.printedLabel?.column ?? null,
      distance: pin.distance,
    })),
  });
}

const segmentTable = [];
const segmentIds = ["a", "b", "c", "d", "e", "f", "g", "dp"];
const stateIds = await setup();
const stateSegmentId = stateIds.segmentId;
for (const segment of segmentIds) {
  await evaluate(
    `(()=>{const id=${JSON.stringify(stateSegmentId)};const brightness={};for(const key of ${JSON.stringify(segmentIds)})brightness[id+':'+key]=0;brightness[id+':'+${JSON.stringify(segment)}]=1;window.__LCD_SIM_STORE__.setState({status:'running',ledBrightness:brightness});return true;})()`,
  );
  await wait(250);
  const metrics = await renderMetrics();
  const litSegments = metrics[stateSegmentId]?.litSegments ?? [];
  const scene = await snapshot();
  const renderedOnCount =
    scene.segments.filter((item) => item.fill === "#e5484d").length +
    scene.dots.filter((item) => item.fill === "#e5484d").length;
  segmentTable.push({
    pinId: segment,
    segment: segment.toUpperCase(),
    litSegments,
    renderedOnCount,
    onlyMatch: litSegments.length === 1 && litSegments[0] === segment,
  });
}

const occupantIds = await setup();
const occupantPart = (await pinDebug()).find((item) => item.partId === occupantIds.segmentId);
const occupiedTopLeft = { x: boardHole(10, 90).x - 5, y: 90 };
await evaluate(
  `(()=>{const state=window.__LCD_STORE__.getState();const doc=state.document;state.replaceDocument({...doc,parts:[...doc.parts,{id:'occupant',type:'seven-segment',position:${JSON.stringify(occupiedTopLeft)},rotation:0,flipX:false,flipY:false,props:{color:'red'}}]});return true;})()`,
);
await wait(250);
const occupiedPreview = await dragPart(
  centerForTopLeft(occupantPart.position),
  centerForTopLeft(occupiedTopLeft),
);
const occupiedReport = await alignmentDebug();
const occupiedWires = await wireCount();

const transformCases = [
  { name: "upright", rotation: 0, flipX: false, flipY: false, hole: boardHole(10, 90) },
  { name: "flip-horizontal", rotation: 0, flipX: true, flipY: false, hole: boardHole(10, 90) },
  { name: "flip-vertical", rotation: 0, flipX: false, flipY: true, hole: boardHole(10, 150) },
  { name: "rotation-180", rotation: 180, flipX: false, flipY: false, hole: boardHole(10, 150) },
  { name: "rotation-90", rotation: 90, flipX: false, flipY: false, hole: { x: 120, y: 70 } },
  { name: "rotation-270", rotation: 270, flipX: false, flipY: false, hole: { x: 60, y: 110 } },
];
const transforms = [];
for (const testCase of transformCases) {
  const ids = await setup();
  await evaluate(
    `(()=>{const state=window.__LCD_STORE__.getState();const doc=state.document;state.replaceDocument({...doc,parts:doc.parts.map(part=>part.id===${JSON.stringify(ids.segmentId)}?{...part,rotation:${testCase.rotation},flipX:${testCase.flipX},flipY:${testCase.flipY}}:part)});return true;})()`,
  );
  await wait(250);
  const part = (await pinDebug()).find((item) => item.partId === ids.segmentId);
  const anchor = part.pins.find((pin) => pin.pinId === "g");
  const topLeft = {
    x: testCase.hole.x - (anchor.x - part.position.x),
    y: testCase.hole.y - (anchor.y - part.position.y),
  };
  await dragPart(centerForTopLeft(part.position), centerForTopLeft(topLeft));
  const report = await alignmentDebug();
  const scene = await snapshot();
  const labels = scene.labels.map((label) => label.text);
  transforms.push({
    name: testCase.name,
    valid: report.valid,
    maxDistance: Math.max(...report.pins.map((pin) => pin.distance)),
    rows: report.pins.map((pin) => pin.printedLabel?.row ?? null),
    columns: report.pins.map((pin) => pin.printedLabel?.column ?? null),
    labels,
    labelsUpright: scene.labels.every(
      (label) => label.scaleX > 0 && label.scaleY > 0,
    ),
  });
}

const wireIds = await setup();
const unoId = await evaluate("window.__LCD_STORE__.getState().addPart('arduino-uno',{x:700,y:180})");
await evaluate(
  `window.__LCD_STORE__.getState().addWire({partId:${JSON.stringify(unoId)},pinId:'D2'},{partId:${JSON.stringify(wireIds.segmentId)},pinId:'a'});true`,
);
await wait(250);
const beforePart = (await pinDebug()).find((item) => item.partId === wireIds.segmentId);
const beforeEndpoint = (await wireEndpoints()).find(
  (wire) => wire.to.partId === wireIds.segmentId && wire.to.pinId === "a",
)?.to;
const wireTargetTopLeft = { x: boardHole(14, 90).x - 5, y: 90 };
await dragPart(centerForTopLeft(beforePart.position), centerForTopLeft(wireTargetTopLeft));
const afterPart = (await pinDebug()).find((item) => item.partId === wireIds.segmentId);
const afterEndpoint = (await wireEndpoints()).find(
  (wire) => wire.to.partId === wireIds.segmentId && wire.to.pinId === "a",
)?.to;
const afterPin = afterPart.pins.find((pin) => pin.pinId === "a");
const wireFollow = {
  beforeRef: beforeEndpoint ? { partId: beforeEndpoint.partId, pinId: beforeEndpoint.pinId } : null,
  afterRef: afterEndpoint ? { partId: afterEndpoint.partId, pinId: afterEndpoint.pinId } : null,
  beforeWorld: beforeEndpoint?.world ?? null,
  afterEndpointWorld: afterEndpoint?.world ?? null,
  afterPinWorld: { x: afterPin.x, y: afterPin.y },
  endpointMatchesPin: afterEndpoint
    ? distance(afterEndpoint.world, { x: afterPin.x, y: afterPin.y }) < 0.01
    : false,
};

const checks = {
  pinIdsUnchanged: pinTable.every((pin) => oldById.has(pin.pinId)),
  spacing: spacing.pitch === 10 && spacing.rowGap === 60,
  topRowCF: drops.every((drop) => drop.rows.slice(0, 5).every((row) => row === "c")),
  bottomRowH: drops.every((drop) => drop.rows.slice(5).every((row) => row === "h")),
  dropAlignment: drops.every((drop) => drop.valid && drop.maxDistance < 0.01),
  dropPreviewGreen: drops.every((drop) => drop.previewStroke === "#3ddc84"),
  segmentStates: segmentTable.every((row) => row.onlyMatch),
  segmentsRendered:
    renderedSegments.length === 7 &&
    renderedSegments.every((item) => item.pointCount === 12),
  segmentVisualStates: segmentTable.every((row) => row.renderedOnCount === 1),
  tallBody: visual.body?.width === 50 && visual.body?.height === 70,
  bodyCentered: visual.body?.x === 0 && visual.body?.y === -5,
  bodyOverhangsPins:
    visual.bodyOverhangTop === 5 && visual.bodyOverhangBottom === 5,
  digitAreaSized:
    Math.abs((visual.digitArea?.width ?? 0) - 32) < 0.01 &&
    Math.abs((visual.digitArea?.height ?? 0) - 48) < 0.01,
  digitFitsNominalArea:
    (visual.digitTop ?? -99) >= -2.41 &&
    (visual.digitBottom ?? 99) <= 2.41 &&
    (visual.digitWidth ?? 0) > 3 &&
    (visual.digitWidth ?? 0) < 3.5,
  segmentConstants:
    Math.abs((visual.thicknessPitch ?? 0) - 0.6) < 0.001 &&
    Math.abs((visual.gapPitch ?? 0) - 0.08) < 0.001 &&
    Math.abs((visual.horizontalLengthPitch ?? 0) - 2.6) < 0.001 &&
    Math.abs((visual.verticalLengthPitch ?? 0) - 2) < 0.001 &&
    Math.abs((visual.bevelPitch ?? 0) - 0.3) < 0.001,
  neighborGapsExact:
    visual.maxGapError <= 0.01 && visual.maxRenderedGapError <= 0.01,
  verticalSegmentsAspect: (visual.verticalAspect ?? 0) >= 3,
  slantDefaultZero: visual.slantDeg === 0,
  slantSwitchWorks:
    visual.slantSwitch.minusSix === -6 &&
    visual.slantSwitch.backToZero === 0 &&
    visual.slantSwitch.maxGapErrorMinusSix <= 0.01 &&
    visual.slantSwitch.maxGapErrorBackToZero <= 0.01,
  dpRadiusRound: Math.abs((visual.dpRadiusPitch ?? 0) - 0.25) < 0.001,
  digitClearsPinRings:
    (visual.topIdleClearance ?? 0) > 0 &&
    (visual.bottomIdleClearance ?? 0) > 0 &&
    (visual.topActiveClearance ?? 0) > 0 &&
    (visual.bottomActiveClearance ?? 0) > 0,
  dpClearOfPinsAndDigits:
    (visual.dpPinClearance ?? 0) >= 0.15 &&
    (visual.dpSegmentClearance ?? 0) > 0.05,
  adjacentHolesClear:
    (visual.adjacentHoles?.topClearance ?? 0) > 1 &&
    (visual.adjacentHoles?.bottomClearance ?? 0) > 1,
  padRingsVisible:
    visual.padRings === 10 && visual.idleRingPitch >= 0.25 && visual.idleRingPitch <= 0.3,
  labelChipsVisible: visual.labelChips === 10,
  labelChipsUprightOutsideBody: visual.chipsUpright && visual.labelsOutsideBody,
  occupiedRejected:
    occupiedReport.valid === false &&
    occupiedPreview.at(-1)?.stroke === "#ff4d4f" &&
    occupiedWires === 0,
  transformsValid: transforms.every(
    (item) => item.valid && item.maxDistance < 0.01 && item.labelsUpright,
  ),
  wireFollowsPin:
    wireFollow.afterRef?.partId === wireIds.segmentId &&
    wireFollow.afterRef?.pinId === "a" &&
    wireFollow.endpointMatchesPin,
  consoleErrors: consoleErrors.length === 0,
};
const result = {
  pinTable,
  spacing,
  visual,
  renderedSegments,
  drops,
  segmentTable,
  occupiedRejected: {
    valid: occupiedReport.valid,
    previewStroke: occupiedPreview.at(-1)?.stroke ?? null,
    wires: occupiedWires,
  },
  transforms,
  wireFollow,
  consoleErrors,
  checks,
  pass: Object.values(checks).every(Boolean),
};
const logFile = path.join(outDir, "acceptance-log.json");
fs.writeFileSync(logFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, logFile }, null, 2));
ws.close();

const port = process.env.CDP_PORT || "9334";
const command = process.argv[2] || "report";
const printedColumn = Number(process.env.COLUMN || 27);
const spacing = Number(process.env.SPACING || 2);
const rowMode = process.env.ROW_MODE || "visual";

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
  if (result.exceptionDetails !== void 0)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
await new Promise((resolve) => (ws.onopen = resolve));
await send("Page.enable");

const snapshotExpr = `(() => {const el=document.querySelector('[data-testid="circuit-canvas"]');const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));let root=el[key];while(root.return)root=root.return;let t=null;const findStage=n=>{if(!n||t)return;if(typeof n.elementType==='function'&&n.elementType.name==='StageWrap'){t=n;return;}findStage(n.child);findStage(n.sibling);};findStage(root);let h=t.memoizedState;while(h&&h.memoizedState&&!h.memoizedState.current?.getLayers)h=h.next;const stage=h.memoizedState.current,layer=stage.getLayers()[0],rect=el.getBoundingClientRect();const btn={},preview=[],groups=[],bodies=[];let board=null;const walk=n=>{if(!n)return;if(n.className==='Text'&&typeof n.text==='function'){const txt=n.text();const p=n.getParent();const circle=p?.getChildren?.().find(c=>c.className==='Circle'&&typeof c.radius==='function'&&Math.abs(c.radius()-4)<0.01);if(circle&&['1A','1B','2A','2B'].includes(txt))btn[txt]={x:circle.x(),y:circle.y(),fill:circle.fill()};}if(n.className==='Circle'&&typeof n.stroke==='function'){const stroke=String(n.stroke()||'').toLowerCase(),fill=String(n.fill()||'').toLowerCase();if(stroke==='#ff4d4f'||stroke==='#3ddc84')preview.push({x:n.x(),y:n.y(),stroke,fill});}if(typeof n.draggable==='function'&&n.draggable()){const rects=(n.getChildren?.()||[]).filter(c=>c.className==='Rect'&&c.width&&c.height).map(c=>({w:c.width(),h:c.height()}));const g={x:n.x(),y:n.y(),offsetX:n.offsetX(),offsetY:n.offsetY(),rects};groups.push(g);if(rects.some(r=>r.w>400))board=g;if(rects.some(r=>r.w>=20&&r.w<=40&&r.w===r.h))bodies.push(g);}for(const c of n.getChildren?n.getChildren():[])walk(c);};stage.getLayers().forEach(walk);const holes={};if(board){const left=board.x-board.offsetX,top=board.y-board.offsetY;const rows={a:0,b:1,c:2,d:3,e:4,f:0,g:1,h:2,i:3,j:4};const firstY=row=>row<='e'?60:120;for(const [row,ri] of Object.entries(rows))for(let col=1;col<=45;col++)holes[row+col]={x:left+30+(col-1)*10,y:top+firstY(row)+ri*10};}return JSON.stringify({btn,holes,preview,bodies,body:bodies[0]?.rects.find(r=>r.w>=20&&r.w<=40),center:bodies[0]?{x:bodies[0].x,y:bodies[0].y}:null,boardTopLeft:board?{x:board.x-board.offsetX,y:board.y-board.offsetY}:null,layer:{x:layer.x(),y:layer.y(),scale:layer.scaleX()},rect:{left:rect.left,top:rect.top},status:document.body.innerText.match(/\\d+ parts · \\d+ wires/)?.[0]??null});})()`;

const snapshot = async () => JSON.parse(await evaluate(snapshotExpr));
const debug = async () => evaluate("window.__PUSH_BUTTON_ALIGNMENT_DEBUG__ ?? null");
const toPage = (point, snap) => ({
  x: snap.rect.left + snap.layer.x + point.x * snap.layer.scale,
  y: snap.rect.top + snap.layer.y + point.y * snap.layer.scale,
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
const targetAt = (snap, column) => ({
  x: snap.boardTopLeft.x + 30 + (column - 1 + spacing / 2) * 10,
  y: snap.boardTopLeft.y + (rowMode === "internal" ? 110 : 120),
});
const wireCount = (snap) => Number(snap.status?.match(/(\d+) wires/)?.[1] ?? -1);

async function reload() {
  await send("Page.reload", { ignoreCache: true });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await wait(100);
    const ready = await evaluate(
      "!!document.querySelector('[data-testid=\"circuit-canvas\"]')",
    );
    if (ready) break;
  }
  await wait(700);
}

async function dismissTour() {
  await evaluate(
    "(()=>{const buttons=Array.from(document.querySelectorAll('.cb-tour-card button'));const button=buttons.find(item=>item.innerText.includes('already know'));if(button)button.click();return true;})()",
  );
  await wait(250);
}

async function setSection(value) {
  await evaluate(
    `(()=>{const select=document.querySelector('[data-testid="parts-section"]');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
  );
  await wait(250);
}

async function addPart(type, section) {
  await setSection(section);
  await evaluate(
    `document.querySelector('[data-part-type="${type}"]')?.click()`,
  );
  await wait(450);
}

async function setup({ buttons = 1 } = {}) {
  await dismissTour();
  await addPart("breadboard", "boards");
  for (let index = 0; index < buttons; index += 1)
    await addPart("push-button", "inputs");
}

async function dragBody(from, target, snap) {
  const preview = [];
  const fromPage = toPage(from, snap);
  const toPagePoint = toPage(target, snap);
  await mouse("mouseMoved", fromPage);
  await mouse("mousePressed", fromPage, 1);
  for (let step = 1; step <= 10; step += 1) {
    const ratio = step / 10;
    await mouse(
      "mouseMoved",
      {
        x: fromPage.x + (toPagePoint.x - fromPage.x) * ratio,
        y: fromPage.y + (toPagePoint.y - fromPage.y) * ratio,
      },
      1,
    );
    const current = await snapshot();
    if (current.preview.length > 0) preview.splice(0, preview.length, ...current.preview);
  }
  await mouse("mouseReleased", toPagePoint);
  await wait(600);
  return preview;
}

function validateReport(report, column) {
  const byPin = new Map(report.debug.pins.map((pin) => [pin.pinId, pin]));
  const expectedColumns = new Set([column, column + spacing]);
  const topRows = ["1A", "2A"].map((pinId) => byPin.get(pinId)?.printedLabel?.row);
  const bottomRows = ["1B", "2B"].map((pinId) => byPin.get(pinId)?.printedLabel?.row);
  const topColumns = new Set(
    ["1A", "2A"].map((pinId) => byPin.get(pinId)?.printedLabel?.column),
  );
  const bottomColumns = new Set(
    ["1B", "2B"].map((pinId) => byPin.get(pinId)?.printedLabel?.column),
  );
  return (
    report.debug.valid === true &&
    report.debug.pins.length === 4 &&
    report.debug.pins.every(
      (pin) => pin.distance !== null && pin.distance < 0.01,
    ) &&
    topRows.every((row) => row === "e") &&
    bottomRows.every((row) => row === "f") &&
    [...topColumns].every((value) => expectedColumns.has(value)) &&
    [...bottomColumns].every((value) => expectedColumns.has(value)) &&
    topColumns.size === 2 &&
    bottomColumns.size === 2 &&
    report.wires === 4
  );
}

async function report() {
  await reload();
  await setup();
  const initial = await snapshot();
  const target = targetAt(initial, printedColumn);
  const preview = await dragBody(initial.center, target, initial);
  const final = await snapshot();
  const alignment = await debug();
  return {
    targetPrintedColumn: printedColumn,
    rowMode,
    body: initial.body,
    preview,
    status: final.status,
    wires: wireCount(final),
    debug: alignment,
  };
}

async function fivePositions() {
  const results = [];
  for (const column of [7, 13, 19, 27, 37]) {
    const result = await reportWithColumn(column);
    results.push({
      column,
      pass: validateReport(result, column),
      pins: result.debug.pins.map((pin) => ({
        pinId: pin.pinId,
        anchor: pin.anchor,
        hole: pin.hole,
        printedLabel: pin.printedLabel?.label ?? null,
        distance: pin.distance,
      })),
      status: result.status,
    });
  }
  return results;
}

async function reportWithColumn(column) {
  await reload();
  await setup();
  const initial = await snapshot();
  const target = targetAt(initial, column);
  await dragBody(initial.center, target, initial);
  const final = await snapshot();
  return {
    wires: wireCount(final),
    status: final.status,
    debug: await debug(),
  };
}

async function occupied() {
  await reload();
  await setup({ buttons: 1 });
  const initial = await snapshot();
  await dragBody(initial.center, targetAt(initial, 10), initial);
  await addPart("push-button", "inputs");
  const withSecond = await snapshot();
  const firstTarget = targetAt(withSecond, 10);
  const secondBody = withSecond.bodies
    .filter((body) => distance({ x: body.x, y: body.y }, firstTarget) > 20)
    .sort(
      (a, b) =>
        distance({ x: b.x, y: b.y }, firstTarget) -
        distance({ x: a.x, y: a.y }, firstTarget),
    )[0];
  await dragBody({ x: secondBody.x, y: secondBody.y }, targetAt(withSecond, 27), withSecond);
  const beforeConflict = await snapshot();
  const occupantTarget = targetAt(beforeConflict, 10);
  const movingBody = beforeConflict.bodies.find(
    (body) => distance({ x: body.x, y: body.y }, occupantTarget) < 10,
  );
  await dragBody(
    { x: movingBody.x, y: movingBody.y },
    targetAt(beforeConflict, 27),
    beforeConflict,
  );
  const afterConflict = await snapshot();
  const alignment = await debug();
  return {
    beforeStatus: beforeConflict.status,
    afterStatus: afterConflict.status,
    beforeWires: wireCount(beforeConflict),
    afterWires: wireCount(afterConflict),
    debug: alignment,
    pass:
      wireCount(beforeConflict) === 8 &&
      wireCount(afterConflict) === 8 &&
      alignment?.valid === false &&
      distance(
        { x: movingBody.x, y: movingBody.y },
        targetAt(beforeConflict, 10),
      ) < 10,
  };
}

let output;
if (command === "five") output = await fivePositions();
else if (command === "occupied") output = await occupied();
else output = await report();
console.log(JSON.stringify(output, null, 2));
ws.close();

import fs from "node:fs";

const port = process.env.CDP_PORT || "9334";
const outDir = "/tmp/opencode/samples-menu";
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const refKey = (ref) => `${ref.partId}:${ref.pinId}`;
const pin = (partId, pinId) => ({ partId, pinId });
const connectivityFor = (file, expected) => {
  const doc = JSON.parse(fs.readFileSync(`resources/samples/${file}`, "utf8")).circuit;
  const parent = new Map();
  const find = (key) => {
    let root = key;
    while (parent.get(root) !== void 0 && parent.get(root) !== root) root = parent.get(root);
    let walk = key;
    while (parent.get(walk) !== void 0 && parent.get(walk) !== walk) {
      const next = parent.get(walk);
      parent.set(walk, root);
      walk = next;
    }
    return root;
  };
  const ensure = (ref) => {
    const key = refKey(ref);
    if (!parent.has(key)) parent.set(key, key);
    return key;
  };
  const union = (first, second) => {
    const rootFirst = find(first);
    const rootSecond = find(second);
    if (rootFirst !== rootSecond) parent.set(rootSecond, rootFirst);
  };
  for (const part of doc.parts) {
    if (part.type !== "breadboard") continue;
    const boardPin = (pinId) => ({ partId: part.id, pinId });
    for (let column = 1; column <= 45; column += 1) {
      const top = ensure(boardPin(`a${column}`));
      for (const row of ["b", "c", "d", "e"]) union(top, ensure(boardPin(`${row}${column}`)));
      const bottom = ensure(boardPin(`f${column}`));
      for (const row of ["g", "h", "i", "j"]) union(bottom, ensure(boardPin(`${row}${column}`)));
      for (const prefix of ["top-plus", "top-minus", "bottom-plus", "bottom-minus"]) {
        const first = ensure(boardPin(`${prefix}-1`));
        for (let railColumn = 2; railColumn <= 45; railColumn += 1)
          union(first, ensure(boardPin(`${prefix}-${railColumn}`)));
      }
    }
  }
  for (const wire of doc.wires) union(ensure(wire.from), ensure(wire.to));
  const connections = expected.map(([from, to]) => {
    const fromKey = refKey(from);
    const toKey = refKey(to);
    return {
      from: fromKey,
      to: toKey,
      connected: parent.has(fromKey) && parent.has(toKey) && find(fromKey) === find(toKey),
    };
  });
  return { file, pass: connections.every((entry) => entry.connected), connections };
};
const connectivity = [
  connectivityFor("blink-led.vcc", [
    [pin("uno", "D13"), pin("r1", "lead1")],
    [pin("r1", "lead2"), pin("led1", "anode")],
    [pin("led1", "cathode"), pin("uno", "GND")],
  ]),
  connectivityFor("traffic-light.vcc", [
    [pin("uno", "D13"), pin("r1", "lead1")],
    [pin("r1", "lead2"), pin("led1", "anode")],
    [pin("led1", "cathode"), pin("uno", "GND")],
    [pin("uno", "D12"), pin("r2", "lead1")],
    [pin("r2", "lead2"), pin("led2", "anode")],
    [pin("led2", "cathode"), pin("uno", "GND")],
    [pin("uno", "D11"), pin("r3", "lead1")],
    [pin("r3", "lead2"), pin("led3", "anode")],
    [pin("led3", "cathode"), pin("uno", "GND")],
  ]),
  connectivityFor("seven-segment-counter.vcc", [
    [pin("uno", "D2"), pin("ra", "lead1")],
    [pin("ra", "lead2"), pin("seg1", "a")],
    [pin("uno", "D3"), pin("rb", "lead1")],
    [pin("rb", "lead2"), pin("seg1", "b")],
    [pin("uno", "D4"), pin("rc", "lead1")],
    [pin("rc", "lead2"), pin("seg1", "c")],
    [pin("uno", "D5"), pin("rd", "lead1")],
    [pin("rd", "lead2"), pin("seg1", "d")],
    [pin("uno", "D6"), pin("re", "lead1")],
    [pin("re", "lead2"), pin("seg1", "e")],
    [pin("uno", "D7"), pin("rf", "lead1")],
    [pin("rf", "lead2"), pin("seg1", "f")],
    [pin("uno", "D8"), pin("rg", "lead1")],
    [pin("rg", "lead2"), pin("seg1", "g")],
    [pin("uno", "D9"), pin("rdp", "lead1")],
    [pin("rdp", "lead2"), pin("seg1", "dp")],
    [pin("uno", "GND"), pin("seg1", "common")],
  ]),
  connectivityFor("potentiometer.vcc", [
    [pin("uno", "5V"), pin("pot1", "3")],
    [pin("uno", "GND"), pin("pot1", "1")],
    [pin("uno", "A0"), pin("pot1", "2")],
    [pin("uno", "D9"), pin("r1", "lead1")],
    [pin("r1", "lead2"), pin("led1", "anode")],
    [pin("led1", "cathode"), pin("uno", "GND2")],
  ]),
];
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
const target = targets.find((item) => item.type === "page" && (item.url.startsWith("file:") || item.url.startsWith("http:")));
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
const screenshot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png" });
  const file = `${outDir}/${name}`;
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  return file;
};
await new Promise((resolve) => (ws.onopen = resolve));
await send("Runtime.enable");
await send("Page.enable");
await evaluate(
  "(()=>{const b=document.querySelector('.cb-tour-skip')||document.querySelector('.cb-tour-close');b?.click();return true;})()",
);
await wait(300);

const snapshot = () =>
  evaluate(`(()=>{
    const modal=document.querySelector('[data-testid="starter-modal"]');
    if(!modal) return {open:false};
    const groups=[...modal.querySelectorAll('[data-testid^="sample-group-"]')].map((group)=>({
      id:group.getAttribute('data-testid').replace('sample-group-',''),
      expanded:group.querySelector('[data-testid^="sample-category-"]')?.getAttribute('aria-expanded')==='true',
      hidden:group.querySelector('.cb-sample-group-body')?.hidden===true,
      cards:group.querySelectorAll('.cb-starter-card').length,
    }));
    return {
      open:true,
      title:document.querySelector('#starter-title')?.textContent,
      titlePaddingLeft:getComputedStyle(document.querySelector('.cb-starter-modal > .cb-starter-title')).paddingLeft,
      chevronIcons:modal.querySelectorAll('.cb-sample-group-header .cb-chevron svg').length,
      count:document.querySelector('.cb-samples-count')?.textContent,
      toggleAll:document.querySelector('[data-testid="samples-toggle-all"]')?.textContent,
      groups,
      totalCards:modal.querySelectorAll('.cb-starter-card').length,
      sampleCards:[...modal.querySelectorAll('[data-testid^="sample-card-"]')].map((card)=>({
        id:card.getAttribute('data-testid').replace('sample-card-',''),
        title:card.querySelector('.cb-starter-card-title')?.textContent,
      })),
    };
  })()`);

await evaluate("document.querySelector('[data-testid=\"samples-toggle\"]').click(); true");
await wait(400);
const opened = await snapshot();
const openedScreenshot = await screenshot("samples-open.png");

await evaluate("document.querySelector('[data-testid=\"sample-category-microcontrollers\"]').click(); true");
await wait(200);
const collapsed = await snapshot();
const collapsedScreenshot = await screenshot("samples-collapsed.png");

await evaluate("document.querySelector('[data-testid=\"samples-toggle-all\"]').click(); true");
await wait(200);
await evaluate("document.querySelector('[data-testid=\"samples-toggle-all\"]').click(); true");
await wait(200);
const allCollapsedText = await evaluate("document.querySelector('[data-testid=\"samples-toggle-all\"]').textContent");
await evaluate("document.querySelector('[data-testid=\"samples-toggle-all\"]').click(); true");
await wait(200);
const allExpanded = await snapshot();

await evaluate(`(()=>{
  const input=document.querySelector('[data-testid="samples-search"]');
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  setter.call(input,'blink');
  input.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
})()`);
await wait(250);
const searched = await snapshot();
const searchedScreenshot = await screenshot("samples-search.png");

await evaluate(`(()=>{
  const input=document.querySelector('[data-testid="samples-search"]');
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  setter.call(input,'');
  input.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
})()`);
await wait(200);
await evaluate("document.querySelector('[data-testid=\"starter-card-uno-lcd-hello\"]').click(); true");
await wait(400);
const lcdResult = await evaluate(`({
  modalOpen:Boolean(document.querySelector('[data-testid="starter-modal"]')),
  title:document.querySelector('[data-testid="project-title"]')?.value,
  types:window.__LCD_STORE__.getState().document.parts.map((part)=>part.type),
  wires:window.__LCD_STORE__.getState().document.wires.length,
})`);
await evaluate("document.querySelector('[data-testid=\"samples-toggle\"]').click(); true");
await wait(350);
await evaluate("document.querySelector('[data-testid=\"starter-card-uno-button-led\"]').click(); true");
await wait(400);
const starterResult = await evaluate(`({
  modalOpen:Boolean(document.querySelector('[data-testid="starter-modal"]')),
  title:document.querySelector('[data-testid="project-title"]')?.value,
  parts:window.__LCD_STORE__.getState().document.parts.length,
  wires:window.__LCD_STORE__.getState().document.wires.length,
})`);

await evaluate("document.querySelector('[data-testid=\"samples-toggle\"]').click(); true");
await wait(350);
await evaluate("document.querySelector('[data-testid=\"sample-card-blink-led.vcc\"]').click(); true");
await wait(700);
const sampleResult = await evaluate(`({
  modalOpen:Boolean(document.querySelector('[data-testid="starter-modal"]')),
  title:document.querySelector('[data-testid="project-title"]')?.value,
  types:window.__LCD_STORE__.getState().document.parts.map((part)=>part.type),
  parts:window.__LCD_STORE__.getState().document.parts.length,
  fromParts:[...new Set(window.__LCD_STORE__.getState().document.wires.map((wire)=>wire.from.partId))],
  toParts:[...new Set(window.__LCD_STORE__.getState().document.wires.map((wire)=>wire.to.partId))],
  directPartWires:window.__LCD_STORE__.getState().document.wires.filter((wire)=>
    wire.from.partId==='uno' && ['led','resistor'].includes(
      window.__LCD_STORE__.getState().document.parts.find((part)=>part.id===wire.to.partId)?.type
    )
  ).length,
  wires:window.__LCD_STORE__.getState().document.wires.length,
})`);
const sampleScreenshot = await screenshot("blink-led-sample.png");

await evaluate("document.querySelector('[data-testid=\"samples-toggle\"]').click(); true");
await wait(350);
await evaluate("document.querySelector('[data-testid=\"sample-card-traffic-light.vcc\"]').click(); true");
await wait(700);
const trafficResult = await evaluate(`({
  modalOpen:Boolean(document.querySelector('[data-testid="starter-modal"]')),
  title:document.querySelector('[data-testid="project-title"]')?.value,
  types:window.__LCD_STORE__.getState().document.parts.map((part)=>part.type),
  parts:window.__LCD_STORE__.getState().document.parts.length,
  fromParts:[...new Set(window.__LCD_STORE__.getState().document.wires.map((wire)=>wire.from.partId))],
  toParts:[...new Set(window.__LCD_STORE__.getState().document.wires.map((wire)=>wire.to.partId))],
  directPartWires:window.__LCD_STORE__.getState().document.wires.filter((wire)=>
    wire.from.partId==='uno' && ['led','resistor'].includes(
      window.__LCD_STORE__.getState().document.parts.find((part)=>part.id===wire.to.partId)?.type
    )
  ).length,
  wires:window.__LCD_STORE__.getState().document.wires.length,
})`);
const trafficScreenshot = await screenshot("traffic-light-sample.png");

await evaluate("document.querySelector('[data-testid=\"samples-toggle\"]').click(); true");
await wait(350);
const sevenSegmentCard = (await snapshot()).sampleCards.find(
  (card) => card.id === "seven-segment-counter.vcc",
);
await evaluate("document.querySelector('[data-testid=\"sample-card-seven-segment-counter.vcc\"]').click(); true");
await wait(700);
const sevenSegmentSampleResult = await evaluate(`({
  modalOpen:Boolean(document.querySelector('[data-testid="starter-modal"]')),
  title:document.querySelector('[data-testid="project-title"]')?.value,
  types:window.__LCD_STORE__.getState().document.parts.map((part)=>part.type),
  resistorCount:window.__LCD_STORE__.getState().document.parts.filter((part)=>part.type==='resistor').length,
  fromParts:[...new Set(window.__LCD_STORE__.getState().document.wires.map((wire)=>wire.from.partId))],
  toParts:[...new Set(window.__LCD_STORE__.getState().document.wires.map((wire)=>wire.to.partId))],
  directPartWires:window.__LCD_STORE__.getState().document.wires.filter((wire)=>
    wire.from.partId==='uno' && ['led','resistor','seven-segment'].includes(
      window.__LCD_STORE__.getState().document.parts.find((part)=>part.id===wire.to.partId)?.type
    )
  ).length,
  pins:window.__LCD_STORE__.getState().document.wires.map((wire)=>wire.to.pinId),
  wires:window.__LCD_STORE__.getState().document.wires.length,
})`);
const sevenSegmentScreenshot = await screenshot("seven-segment-sample.png");

await evaluate("document.querySelector('[data-testid=\"samples-toggle\"]').click(); true");
await wait(350);
const potentiometerCard = (await snapshot()).sampleCards.find(
  (card) => card.id === "potentiometer.vcc",
);
await evaluate("document.querySelector('[data-testid=\"sample-card-potentiometer.vcc\"]').click(); true");
await wait(700);
const potentiometerResult = await evaluate(`({
  modalOpen:Boolean(document.querySelector('[data-testid="starter-modal"]')),
  title:document.querySelector('[data-testid="project-title"]')?.value,
  types:window.__LCD_STORE__.getState().document.parts.map((part)=>part.type),
  wires:window.__LCD_STORE__.getState().document.wires.length,
})`);
const potentiometerScreenshot = await screenshot("potentiometer-sample.png");

await evaluate("document.querySelector('[data-testid=\"file-menu-toggle\"]').click(); true");
await wait(150);
const fileMenuItem = await evaluate("document.querySelector('[data-testid=\"file-samples\"]')?.textContent");
await evaluate("document.querySelector('[data-testid=\"file-samples\"]').click(); true");
await wait(350);
const fileMenuOpened = (await snapshot()).open;

const result = {
  opened,
  collapsed,
  allCollapsedText,
  allExpanded,
  searched,
  lcdResult,
  starterResult,
  sampleResult,
  trafficResult,
  sevenSegmentCard,
  sevenSegmentSampleResult,
  potentiometerCard,
  potentiometerResult,
  connectivity,
  fileMenuItem,
  fileMenuOpened,
  screenshots: [openedScreenshot, collapsedScreenshot, searchedScreenshot, sampleScreenshot, trafficScreenshot, sevenSegmentScreenshot, potentiometerScreenshot],
  consoleErrors,
};
result.pass =
  opened.open &&
  opened.groups.length >= 4 &&
  opened.totalCards >= 10 &&
  opened.titlePaddingLeft === "24px" &&
  opened.chevronIcons === opened.groups.length &&
  opened.groups.find((group) => group.id === "displays")?.cards === 1 &&
  collapsed.groups.find((group) => group.id === "microcontrollers")?.hidden === true &&
  allCollapsedText === "Expand all" &&
  allExpanded.groups.every((group) => group.expanded && !group.hidden) &&
  searched.totalCards > 0 &&
  searched.totalCards < opened.totalCards &&
  lcdResult.modalOpen === false &&
  lcdResult.types.includes("lcd-16x2-i2c") &&
  lcdResult.wires === 4 &&
  starterResult.modalOpen === false &&
  starterResult.parts > 1 &&
  starterResult.wires > 0 &&
  sampleResult.modalOpen === false &&
  sampleResult.types.includes("breadboard") &&
  sampleResult.toParts.includes("bb1") &&
  sampleResult.directPartWires === 0 &&
  sampleResult.parts > 1 &&
  sampleResult.wires > 0 &&
  trafficResult.modalOpen === false &&
  trafficResult.types.includes("breadboard") &&
  trafficResult.toParts.includes("bb1") &&
  trafficResult.directPartWires === 0 &&
  trafficResult.parts > 1 &&
  trafficResult.wires > 0 &&
  sevenSegmentCard?.title === "Seven segment counter" &&
  sevenSegmentSampleResult.modalOpen === false &&
  sevenSegmentSampleResult.title === "Seven segment counter" &&
  sevenSegmentSampleResult.types.includes("seven-segment") &&
  sevenSegmentSampleResult.types.includes("breadboard") &&
  sevenSegmentSampleResult.fromParts.includes("bb1") &&
  sevenSegmentSampleResult.toParts.includes("bb1") &&
  sevenSegmentSampleResult.toParts.includes("seg1") &&
  sevenSegmentSampleResult.resistorCount === 8 &&
  sevenSegmentSampleResult.directPartWires === 0 &&
    ["a","b","c","d","e","f","g","dp","common"].every((pin) =>
      sevenSegmentSampleResult.pins.includes(pin),
    ) &&
    sevenSegmentSampleResult.wires === 34 &&
    potentiometerCard?.title === "Potentiometer" &&
    potentiometerResult.modalOpen === false &&
    potentiometerResult.title === "Potentiometer" &&
    potentiometerResult.types.includes("potentiometer") &&
    potentiometerResult.wires === 6 &&
    connectivity.every((entry) => entry.pass) &&
  fileMenuItem === "Sample circuits…" &&
  fileMenuOpened &&
  consoleErrors.length === 0;
const logFile = `${outDir}/acceptance-log.json`;
fs.writeFileSync(logFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, logFile }, null, 2));
ws.close();

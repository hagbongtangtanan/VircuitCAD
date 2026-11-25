"use strict";

/**
 * Shared probe for the running app: launches a build with a sample, captures
 * the screen and measures the rendered potentiometer (body rim, knob disc and
 * pointer).
 *
 * The measurement can be taken twice: once before an interaction and once
 * after it, so that a control can be driven and its effect measured.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const electronBinary = path.join(root, "node_modules", "electron", "dist", "electron");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findPage(port) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      const page = pages.find((entry) => entry.type === "page");
      if (page) return page;
    } catch {
    }
    await sleep(200);
  }
  throw new Error("no renderer page appeared");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const exceptions = [];
    let requestId = 0;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        exceptions.push(
          String(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text).slice(0, 400),
        );
      }
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    };
    socket.onopen = () =>
      resolve({
        exceptions,
        send(method, params = {}) {
          return new Promise((resolveCall) => {
            const id = ++requestId;
            pending.set(id, resolveCall);
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
      });
    socket.onerror = () => reject(new Error("cdp socket error"));
  });
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

const isKnobPixel = (r, g, b) =>
  r >= 30 && r <= 150 && g >= 90 && g <= 200 && b >= 150 && b <= 250 && b - g >= 50 && b - r >= 95;
const isPointerPixel = (r, g, b) => r <= 25 && g <= 32 && b <= 50;

/** Matches the pointer fill exactly; the body fill is a slightly darker tone. */
function pointerMatcher(spec) {
  const pointer = hexToRgb(spec.tokensFor("dark").pointer);
  return (r, g, b) => r === pointer[0] && g === pointer[1] && b === pointer[2];
}

/**
 * Measures the potentiometer in a screenshot of the app window.
 */
async function measurePot(screenshotBuffer, spec, sampleData, canvasRect) {
  const { data, info } = await sharp(screenshotBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const at = (x, y) => {
    const index = (y * info.width + x) * channels;
    return [data[index], data[index + 1], data[index + 2], data[index + 3]];
  };

  const samplePart = sampleData.circuit.parts.find((part) => part.type === "potentiometer");
  const sampleViewport = sampleData.viewport ?? { scale: 1, offsetX: 0, offsetY: 0 };
  const viewScale = sampleViewport.scale ?? 1;
  // The app rotates a part around the centre of its box, so the body disc is
  // rotated with the box when it does not sit exactly on the box centre.
  const partRotation = samplePart.rotation ?? 0;
  const boxCentre = { x: spec.APP_BOX.width / 2, y: spec.APP_BOX.height / 2 };
  const bodyLocal = {
    x: spec.APP_ANCHOR_LOCAL.middle.x + spec.BODY_CENTER.x * spec.APP_SCALE,
    y: spec.APP_ANCHOR_LOCAL.middle.y + spec.BODY_CENTER.y * spec.APP_SCALE,
  };
  const radians = (partRotation * Math.PI) / 180;
  const bodyDx = bodyLocal.x - boxCentre.x;
  const bodyDy = bodyLocal.y - boxCentre.y;
  const bodyCentreLocal = {
    x: boxCentre.x + bodyDx * Math.cos(radians) - bodyDy * Math.sin(radians),
    y: boxCentre.y + bodyDx * Math.sin(radians) + bodyDy * Math.cos(radians),
  };
  const expectedKnobCentre = {
    x:
      canvasRect.x +
      sampleViewport.offsetX +
      samplePart.position.x +
      bodyCentreLocal.x,
    y:
      canvasRect.y +
      sampleViewport.offsetY +
      samplePart.position.y +
      bodyCentreLocal.y,
  };
  const expectedBodyRadius = spec.BODY_RADIUS * spec.APP_SCALE * viewScale;
  const expectedKnobRadius = spec.KNOB_RADIUS * spec.APP_SCALE * viewScale;

  const region = {
    minX: Math.max(0, Math.floor(canvasRect.x)),
    maxX: Math.min(info.width, Math.ceil(canvasRect.x + canvasRect.width)),
    minY: Math.max(0, Math.floor(canvasRect.y)),
    maxY: Math.min(info.height, Math.ceil(canvasRect.y + canvasRect.height)),
  };
  const search = {
    minX: Math.max(region.minX, Math.floor(expectedKnobCentre.x - expectedBodyRadius * 1.5)),
    maxX: Math.min(region.maxX, Math.ceil(expectedKnobCentre.x + expectedBodyRadius * 1.5)),
    minY: Math.max(region.minY, Math.floor(expectedKnobCentre.y - expectedBodyRadius * 1.5)),
    maxY: Math.min(region.maxY, Math.ceil(expectedKnobCentre.y + expectedBodyRadius * 1.5)),
  };

  // The body rim is a closed circle in a colour nothing else on the canvas
  // uses, so its bounding box gives the body centre and radius. A selected
  // part is covered by the selection outline, so the rim is optional.
  const rimColor = spec.tokensFor("dark").bodyRim;
  const rim = hexToRgb(rimColor);
  const isRimPixel = (r, g, b) =>
    Math.abs(r - rim[0]) <= 20 && Math.abs(g - rim[1]) <= 20 && Math.abs(b - rim[2]) <= 20;
  let rimBox = null;
  for (let y = search.minY; y < search.maxY; y += 1) {
    for (let x = search.minX; x < search.maxX; x += 1) {
      const [r, g, b] = at(x, y);
      if (!isRimPixel(r, g, b)) continue;
      if (!rimBox) rimBox = { minX: x, maxX: x, minY: y, maxY: y, pixels: 0 };
      rimBox.minX = Math.min(rimBox.minX, x);
      rimBox.maxX = Math.max(rimBox.maxX, x);
      rimBox.minY = Math.min(rimBox.minY, y);
      rimBox.maxY = Math.max(rimBox.maxY, y);
      rimBox.pixels += 1;
    }
  }
  const hasRim = Boolean(rimBox) && rimBox.pixels >= 25;
  const bodyRadius = hasRim ? (rimBox.maxX - rimBox.minX) / 2 : null;
  const knobCentre = hasRim
    ? {
        x: (rimBox.minX + rimBox.maxX) / 2,
        y: (rimBox.minY + rimBox.maxY) / 2,
      }
    : expectedKnobCentre;

  // The knob is the blue disc around the body centre. Its radius is read from
  // the distance distribution of the knob pixels, so that the few blue pixels
  // of the wires further out cannot inflate it.
  const knobSearchRadius = expectedKnobRadius * 1.4;
  const knobDistances = [];
  for (let y = Math.floor(knobCentre.y - knobSearchRadius); y <= Math.ceil(knobCentre.y + knobSearchRadius); y += 1) {
    for (let x = Math.floor(knobCentre.x - knobSearchRadius); x <= Math.ceil(knobCentre.x + knobSearchRadius); x += 1) {
      if (x < 0 || y < 0 || x >= info.width || y >= info.height) continue;
      const [r, g, b] = at(x, y);
      if (!isKnobPixel(r, g, b)) continue;
      const distance = Math.hypot(x - knobCentre.x, y - knobCentre.y);
      if (distance > knobSearchRadius) continue;
      knobDistances.push(distance);
    }
  }
  const knobPixels = knobDistances.length;
  if (knobPixels < 40) throw new Error("no potentiometer knob pixels found in the screenshot");
  knobDistances.sort((a, b) => a - b);
  const knobRadius = knobDistances[Math.min(knobDistances.length - 1, Math.floor(knobDistances.length * 0.85))];

  const zoom = viewScale;
  const scan = {
    minX: knobCentre.x - knobRadius,
    maxX: knobCentre.x + knobRadius,
    minY: knobCentre.y - knobRadius,
    maxY: knobCentre.y + knobRadius,
    pixels: knobPixels,
    rim: rimBox,
  };

  const matchesPointer = pointerMatcher(spec);
  // When the part is selected its rim is covered by the selection outline, so
  // the measured centre is not available and the expected one is used.
  const angleCentre = hasRim ? knobCentre : expectedKnobCentre;
  const pointerPixels = [];
  // Only the knob area is searched, so that the dark tails cannot be mistaken
  // for the pointer.
  const pointerRadius = expectedKnobRadius * 1.4;
  const pointerArea = {
    minX: Math.max(search.minX, Math.floor(knobCentre.x - pointerRadius)),
    maxX: Math.min(search.maxX - 1, Math.ceil(knobCentre.x + pointerRadius)),
    minY: Math.max(search.minY, Math.floor(knobCentre.y - pointerRadius)),
    maxY: Math.min(search.maxY - 1, Math.ceil(knobCentre.y + pointerRadius)),
  };
  for (let y = pointerArea.minY; y <= pointerArea.maxY; y += 1) {
    for (let x = pointerArea.minX; x <= pointerArea.maxX; x += 1) {
      const [r, g, b] = at(x, y);
      if (!matchesPointer(r, g, b)) continue;
      pointerPixels.push({ x, y });
    }
  }
  let pointer = null;
  if (pointerPixels.length > 5) {
    // The pointer is a wedge whose base sits on the knob centre, so the
    // direction from the knob centre to the pointer's centre of mass is the
    // pointing direction.
    // The pointer is a small wedge: its tip is the part that is furthest from
    // the knob centre, so the direction of the tip gives the pointing angle.
    let maxDistance = 0;
    for (const pixel of pointerPixels) {
      const distance = Math.hypot(pixel.x - angleCentre.x, pixel.y - angleCentre.y);
      if (distance > maxDistance) maxDistance = distance;
    }
    const tipRing = pointerPixels.filter(
      (pixel) =>
        Math.hypot(pixel.x - angleCentre.x, pixel.y - angleCentre.y) >= maxDistance - 1.5,
    );
    const meanX = tipRing.reduce((sum, pixel) => sum + pixel.x, 0) / tipRing.length;
    const meanY = tipRing.reduce((sum, pixel) => sum + pixel.y, 0) / tipRing.length;
    const ax = meanX - angleCentre.x;
    const ay = meanY - angleCentre.y;
    let angle = (Math.atan2(ax, -ay) * 180) / Math.PI;
    if (angle > 180) angle -= 360;
    if (angle <= -180) angle += 360;
    pointer = {
      angleDeg: angle,
      pixels: pointerPixels.length,
      centre: { x: meanX, y: meanY },
      tip: { x: meanX + ax, y: meanY + ay },
    };
  }

  return {
    screenshotBuffer,
    info,
    data,
    channels,
    at,
    region,
    canvasRect,
    knob: {
      centre: knobCentre,
      radiusPx: knobRadius,
      bodyRadiusPx: bodyRadius,
      pixels: knobPixels,
      expectedCentre: expectedKnobCentre,
      expectedRadiusPx: expectedKnobRadius,
      expectedBodyRadiusPx: expectedBodyRadius,
    },
    pointer,
    zoom,
    scan,
  };
}

async function probe(options) {
  const {
    appPath,
    samplePath,
    port,
    spec,
    renderer,
    screenshotPath = null,
    fit = false,
    interact = null,
  } = options;

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-pot-app-"));
  const child = spawn(
    electronBinary,
    [appPath, samplePath, `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, "--no-sandbox"],
    { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  try {
    const page = await findPage(port);
    const client = await connect(page.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    const evaluate = async (expression) => {
      const response = await client.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (response.result?.exceptionDetails) {
        throw new Error(String(response.result.exceptionDetails.text).slice(0, 300));
      }
      return response.result?.result?.value;
    };

    await sleep(2500);
    await evaluate(
      `(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.innerText.includes("already know")); if (button) button.click(); return true; })()`,
    );
    await sleep(600);
    if (fit) {
      await evaluate(
        `(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.title === "Fit the circuit to the window"); if (button) button.click(); return true; })()`,
      );
      await sleep(1200);
    } else {
      await sleep(1500);
    }

    const canvasRect = JSON.parse(
      await evaluate(`(() => {
        const element = document.querySelector(".konvajs-content") || document.querySelector(".circuit-canvas");
        if (!element) return JSON.stringify(null);
        const rect = element.getBoundingClientRect();
        return JSON.stringify({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      })()`),
    );
    if (!canvasRect) throw new Error("the circuit canvas element was not found");

    const sampleData = JSON.parse(fs.readFileSync(samplePath, "utf8"));

    const capture = async () => {
      const shot = await client.send("Page.captureScreenshot", { format: "png" });
      if (!shot.result?.data) throw new Error("screenshot failed");
      return Buffer.from(shot.result.data, "base64");
    };

    // The renderer can take a moment to draw the loaded project, so the
    // measurement is retried until the potentiometer shows up.
    const captureAndMeasure = async (attempts = 6) => {
      let lastError = null;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const buffer = await capture();
        try {
          return { buffer, measurement: await measurePot(buffer, spec, sampleData, canvasRect) };
        } catch (error) {
          lastError = error;
          await sleep(700);
        }
      }
      throw lastError;
    };

    const initialResult = await captureAndMeasure();
    const initialBuffer = initialResult.buffer;
    const initial = initialResult.measurement;

    if (interact) {
      await interact({ evaluate, client, capture, measure: initial, spec, sampleData, canvasRect });
    }

    const screenshotBuffer = interact ? (await captureAndMeasure()).buffer : initialBuffer;
    const measurement = interact ? await measurePot(screenshotBuffer, spec, sampleData, canvasRect) : initial;
    if (screenshotPath) {
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      fs.writeFileSync(screenshotPath, screenshotBuffer);
    }

    return {
      ...measurement,
      screenshotBuffer,
      screenshotPath,
      initial,
      runtimeExceptions: client.exceptions,
      sample: sampleData,
    };
  } finally {
    child.kill("SIGTERM");
    await sleep(600);
    if (!child.killed) child.kill("SIGKILL");
  }
}

module.exports = { probe, measurePot, isKnobPixel, isPointerPixel };

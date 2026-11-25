"use strict";

/**
 * Compares the potentiometer drawn by the running app with the reference
 * rendering of the shared module.
 *
 * The app's zoom is measured from the rendered body rim, the reference SVG is
 * rasterised at the same scale and aligned to the same body centre, and then
 * the same features (body rim, knob disc, pointer angle) are measured in both
 * images. The pixel difference is reported on blurred copies so that the
 * antialiasing of the two different rasterisers does not dominate.
 *
 * Usage:
 *   node scripts/part-pixel-diff.js [--app out/app-pot.asar] [--value 0.5]
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { probe } = require("./pot-app-probe");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value: --${name}`);
  return value;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

const port = Number(arg("port", "9355"));
const appPath = resolveInput(arg("app", "out/app-pot.asar"));
const samplePath = resolveInput(arg("sample", "resources/samples/potentiometer.vcc"));
const reportPath = resolveInput(arg("report", "reports/part-pixel-diff.json"));
const outDir = resolveInput(arg("out", "pot-new/out/diff"));

const VALUE = Number(arg("value", "0.5"));
const PIXEL_TOLERANCE = Number(arg("tolerance", "24"));
const BLOCK_SIZE = 4;
const BLUR_SIGMA = Number(arg("blur", "2"));

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/**
 * Marks the pixels that the app draws on top of the part: the wires that end
 * at the hidden pins and the pin markers. They are not part of the module's
 * drawing, so they are left out of the comparison.
 */
function buildOverlayMask(raw) {
  const { data, info } = raw;
  const { width, height, channels } = info;
  const at = (x, y) => {
    const index = (y * width + x) * channels;
    return [data[index], data[index + 1], data[index + 2]];
  };
  const wire = [111, 179, 255];
  const dot = [183, 210, 239];
  const near = (color, target, tolerance) =>
    Math.abs(color[0] - target[0]) <= tolerance &&
    Math.abs(color[1] - target[1]) <= tolerance &&
    Math.abs(color[2] - target[2]) <= tolerance;
  const sources = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = at(x, y);
      if (near(color, wire, 6)) sources.push({ x, y, radius: 2.5 });
      else if (near(color, dot, 6)) sources.push({ x, y, radius: 4.5 });
    }
  }
  const mask = new Uint8Array(width * height);
  for (const source of sources) {
    for (let y = Math.max(0, Math.floor(source.y - source.radius)); y <= Math.min(height - 1, Math.ceil(source.y + source.radius)); y += 1) {
      for (let x = Math.max(0, Math.floor(source.x - source.radius)); x <= Math.min(width - 1, Math.ceil(source.x + source.radius)); x += 1) {
        if (Math.hypot(x - source.x, y - source.y) <= source.radius) mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

/** Measures the pot features in a raster image. */
function measurePot(raw, tokens, mask) {
  const { data } = raw;
  const { width, height, channels } = raw.info;
  const at = (x, y) => {
    const index = (y * width + x) * channels;
    return [data[index], data[index + 1], data[index + 2], data[index + 3]];
  };
  const rim = hexToRgb(tokens.bodyRim);
  const isRim = (r, g, b) =>
    Math.abs(r - rim[0]) <= 20 && Math.abs(g - rim[1]) <= 20 && Math.abs(b - rim[2]) <= 20;
  const isKnob = (r, g, b) =>
    r >= 30 && r <= 150 && g >= 90 && g <= 200 && b >= 150 && b <= 250 && b - g >= 50 && b - r >= 95;
  const pointerColor = hexToRgb(tokens.pointer);
  const isPointer = (r, g, b) =>
    r === pointerColor[0] && g === pointerColor[1] && b === pointerColor[2];

  // The rim is the circle around the drawing: it is not covered by the wires
  // or the pin markers, so it gives the centre and the radius of the body.
  let rimBox = null;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask && mask[y * width + x] === 1) continue;
      const [r, g, b] = at(x, y);
      if (r > 150 || g > 200) continue;
      if (!isRim(r, g, b)) continue;
      if (!rimBox) rimBox = { minX: x, maxX: x, minY: y, maxY: y, pixels: 0 };
      rimBox.minX = Math.min(rimBox.minX, x);
      rimBox.maxX = Math.max(rimBox.maxX, x);
      rimBox.minY = Math.min(rimBox.minY, y);
      rimBox.maxY = Math.max(rimBox.maxY, y);
      rimBox.pixels += 1;
    }
  }
  if (!rimBox) return null;
  const bodyRadius = (rimBox.maxX - rimBox.minX) / 2;
  const centre = {
    x: (rimBox.minX + rimBox.maxX) / 2,
    y: (rimBox.minY + rimBox.maxY) / 2,
  };

  // The knob is the blue disc: its radius is the distance that holds most of
  // the knob's pixels.
  const knobDistances = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask && mask[y * width + x] === 1) continue;
      const [r, g, b] = at(x, y);
      if (!isKnob(r, g, b)) continue;
      const distance = Math.hypot(x - centre.x, y - centre.y);
      if (distance > bodyRadius) continue;
      knobDistances.push(distance);
    }
  }
  if (knobDistances.length < 20) return null;
  knobDistances.sort((a, b) => a - b);
  const knobRadius = knobDistances[Math.min(knobDistances.length - 1, Math.floor(knobDistances.length * 0.85))];

  const pointerPixels = [];
  for (let y = Math.floor(centre.y - knobRadius); y <= Math.ceil(centre.y + knobRadius); y += 1) {
    for (let x = Math.floor(centre.x - knobRadius); x <= Math.ceil(centre.x + knobRadius); x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const [r, g, b] = at(x, y);
      if (!isPointer(r, g, b)) continue;
      const distance = Math.hypot(x - centre.x, y - centre.y);
      if (distance > knobRadius * 0.95) continue;
      pointerPixels.push({ x, y, distance });
    }
  }
  let pointerAngle = null;
  if (pointerPixels.length > 6) {
    const meanX = pointerPixels.reduce((sum, pixel) => sum + pixel.x, 0) / pointerPixels.length;
    const meanY = pointerPixels.reduce((sum, pixel) => sum + pixel.y, 0) / pointerPixels.length;
    let angle = (Math.atan2(meanX - centre.x, -(meanY - centre.y)) * 180) / Math.PI;
    if (angle > 180) angle -= 360;
    if (angle <= -180) angle += 360;
    pointerAngle = angle;
  }

  return {
    centre,
    bodyRadius,
    knobRadius,
    rimBox,
    pointerAngle,
    pointerPixels: pointerPixels.length,
  };
}

async function main() {
  const spec = await import(path.join(root, "pot-new", "src", "potSpec.ts"));
  const renderer = await import(path.join(root, "pot-new", "src", "renderPotSvg.ts"));

  fs.mkdirSync(outDir, { recursive: true });
  const screenshotPath = path.join(outDir, `app-pot-${String(VALUE).replace(".", "_")}.png`);
  const result = await probe({
    appPath,
    samplePath,
    port,
    spec,
    renderer,
    screenshotPath,
  });

  const pxPerDesignUnit = result.zoom * spec.APP_SCALE;
  const designBox = {
    minX: spec.BBOX.minX,
    maxX: spec.BBOX.maxX,
    minY: spec.BBOX.minY,
    maxY: spec.BBOX.maxY,
  };
  const samplePart = result.sample.circuit.parts.find((part) => part.type === "potentiometer");
  const partRotation = samplePart ? samplePart.rotation : 0;
  // The app rotates the drawing around the centre of the part box.
  const boxCentre = {
    x: spec.APP_BOX.width / 2 - spec.APP_ANCHOR_LOCAL.middle.x,
    y: spec.APP_BOX.height / 2 - spec.APP_ANCHOR_LOCAL.middle.y,
  };
  const rotateAboutBox = (x, y) => {
    const radians = (partRotation * Math.PI) / 180;
    const dx = x - boxCentre.x;
    const dy = y - boxCentre.y;
    return {
      x: boxCentre.x + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: boxCentre.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    };
  };
  const rotatedCorners = [
    [designBox.minX, designBox.minY],
    [designBox.maxX, designBox.minY],
    [designBox.maxX, designBox.maxY],
    [designBox.minX, designBox.maxY],
  ].map(([x, y]) => rotateAboutBox(x, y));
  const rotatedBox = {
    minX: Math.min(...rotatedCorners.map((corner) => corner.x)),
    maxX: Math.max(...rotatedCorners.map((corner) => corner.x)),
    minY: Math.min(...rotatedCorners.map((corner) => corner.y)),
    maxY: Math.max(...rotatedCorners.map((corner) => corner.y)),
  };
  const boxCentreScreen = {
    x:
      result.canvasRect.x +
      (result.sample.viewport?.offsetX ?? 0) +
      result.sample.circuit.parts.find((part) => part.type === "potentiometer").position.x +
      spec.APP_BOX.width / 2,
    y:
      result.canvasRect.y +
      (result.sample.viewport?.offsetY ?? 0) +
      result.sample.circuit.parts.find((part) => part.type === "potentiometer").position.y +
      spec.APP_BOX.height / 2,
  };
  const screenBox = {
    minX: boxCentreScreen.x + (rotatedBox.minX - boxCentre.x) * pxPerDesignUnit,
    maxX: boxCentreScreen.x + (rotatedBox.maxX - boxCentre.x) * pxPerDesignUnit,
    minY: boxCentreScreen.y + (rotatedBox.minY - boxCentre.y) * pxPerDesignUnit,
    maxY: boxCentreScreen.y + (rotatedBox.maxY - boxCentre.y) * pxPerDesignUnit,
  };
  const cropWidth = Math.round(screenBox.maxX - screenBox.minX);
  const cropHeight = Math.round(screenBox.maxY - screenBox.minY);
  const cropLeft = Math.round(screenBox.minX);
  const cropTop = Math.round(screenBox.minY);

  const appCropBuffer = await sharp(result.screenshotBuffer)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();
  const appCrop = await sharp(appCropBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const svg = renderer.renderPotSvg({ value: VALUE, theme: "dark", showLabels: false });
  const backgroundCounts = new Map();
  for (let index = 0; index < appCrop.data.length; index += appCrop.channels) {
    const key = `${appCrop.data[index]},${appCrop.data[index + 1]},${appCrop.data[index + 2]}`;
    backgroundCounts.set(key, (backgroundCounts.get(key) ?? 0) + 1);
  }
  const backgroundKey = [...backgroundCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const background = backgroundKey.split(",").map(Number);

  const referencePath = path.join(outDir, `ref-pot-${String(VALUE).replace(".", "_")}.png`);
  // The reference is rendered at the app's zoom, rotated around the body
  // centre and placed so that the body centre lands on the app's body centre.
  const baseWidth = Math.round((designBox.maxX - designBox.minX) * pxPerDesignUnit);
  const baseHeight = Math.round((designBox.maxY - designBox.minY) * pxPerDesignUnit);
  const baseCentre = {
    x: (boxCentre.x - designBox.minX) * pxPerDesignUnit,
    y: (boxCentre.y - designBox.minY) * pxPerDesignUnit,
  };
  const radians = (partRotation * Math.PI) / 180;
  const imageCentre = { x: baseWidth / 2, y: baseHeight / 2 };
  const rotatedOffset = {
    x:
      (baseCentre.x - imageCentre.x) * Math.cos(radians) -
      (baseCentre.y - imageCentre.y) * Math.sin(radians),
    y:
      (baseCentre.x - imageCentre.x) * Math.sin(radians) +
      (baseCentre.y - imageCentre.y) * Math.cos(radians),
  };
  const targetCentre = {
    x: boxCentreScreen.x - cropLeft,
    y: boxCentreScreen.y - cropTop,
  };
  const rotatedBuffer = await sharp(Buffer.from(svg), { density: pxPerDesignUnit * 72 })
    .rotate(partRotation)
    .png()
    .toBuffer();
  const rotatedMeta = await sharp(rotatedBuffer).metadata();
  const rotatedCentre = {
    x: rotatedMeta.width / 2 + rotatedOffset.x,
    y: rotatedMeta.height / 2 + rotatedOffset.y,
  };
  await sharp({
    create: {
      width: cropWidth,
      height: cropHeight,
      channels: 4,
      background: { r: background[0], g: background[1], b: background[2], alpha: 1 },
    },
  })
    .composite([
      {
        input: rotatedBuffer,
        left: Math.round(targetCentre.x - rotatedCentre.x),
        top: Math.round(targetCentre.y - rotatedCentre.y),
      },
    ])
    .png()
    .toFile(referencePath);
  const reference = await sharp(referencePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const tokens = spec.tokensFor("dark");
  const overlayMask = buildOverlayMask(appCrop);
  const appFeatures = measurePot(appCrop, tokens, overlayMask);
  const referenceFeatures = measurePot(reference, tokens, null);
  if (!appFeatures || !referenceFeatures) {
    console.log("app features", appFeatures);
    console.log("reference features", referenceFeatures);
    throw new Error("could not measure the pot in one of the images");
  }

  const blockWidth = Math.ceil(reference.info.width / BLOCK_SIZE);
  const blockHeight = Math.ceil(reference.info.height / BLOCK_SIZE);
  const blockedApp = await sharp(appCropBuffer)
    .blur(BLUR_SIGMA)
    .resize(blockWidth, blockHeight, { fit: "fill", kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blockedReference = await sharp(referencePath)
    .blur(BLUR_SIGMA)
    .resize(blockWidth, blockHeight, { fit: "fill", kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const diffBuffer = Buffer.alloc(blockWidth * blockHeight * 3);
  let diffCount = 0;
  let total = 0;
  const mad = [0, 0, 0];
  // Only the body of the pot is compared: outside of it the app draws the
  // breadboard, the grid and the wires, which are not part of the module.
  const maskRadius = appFeatures.bodyRadius * 0.92;
  for (let index = 0; index < blockedReference.data.length; index += 3) {
    const pixel = index / 3;
    const bx = (pixel % blockWidth) * BLOCK_SIZE + BLOCK_SIZE / 2;
    const by = Math.floor(pixel / blockWidth) * BLOCK_SIZE + BLOCK_SIZE / 2;
    const masked = overlayMask.some((value, position) => {
      const mx = position % appCrop.info.width;
      const my = Math.floor(position / appCrop.info.width);
      return Math.abs(mx - bx) <= BLOCK_SIZE && Math.abs(my - by) <= BLOCK_SIZE && value === 1;
    });
    if (masked) {
      const grey = Math.round(
        (blockedApp.data[index] + blockedApp.data[index + 1] + blockedApp.data[index + 2]) / 3,
      );
      diffBuffer[index] = Math.round(grey * 0.3);
      diffBuffer[index + 1] = Math.round(grey * 0.3);
      diffBuffer[index + 2] = Math.round(grey * 0.3);
      continue;
    }
    if (Math.hypot(bx - appFeatures.centre.x, by - appFeatures.centre.y) > maskRadius) {
      const grey = Math.round(
        (blockedApp.data[index] + blockedApp.data[index + 1] + blockedApp.data[index + 2]) / 3,
      );
      diffBuffer[index] = Math.round(grey * 0.3);
      diffBuffer[index + 1] = Math.round(grey * 0.3);
      diffBuffer[index + 2] = Math.round(grey * 0.3);
      continue;
    }
    const dr = Math.abs(blockedApp.data[index] - blockedReference.data[index]);
    const dg = Math.abs(blockedApp.data[index + 1] - blockedReference.data[index + 1]);
    const db = Math.abs(blockedApp.data[index + 2] - blockedReference.data[index + 2]);
    mad[0] += dr;
    mad[1] += dg;
    mad[2] += db;
    total += 1;
    if (dr > PIXEL_TOLERANCE || dg > PIXEL_TOLERANCE || db > PIXEL_TOLERANCE) {
      diffCount += 1;
      diffBuffer[index] = 255;
      diffBuffer[index + 1] = 0;
      diffBuffer[index + 2] = 0;
    } else {
      const grey = Math.round(
        (blockedApp.data[index] + blockedApp.data[index + 1] + blockedApp.data[index + 2]) / 3,
      );
      diffBuffer[index] = Math.round(grey * 0.3);
      diffBuffer[index + 1] = Math.round(grey * 0.3);
      diffBuffer[index + 2] = Math.round(grey * 0.3);
    }
  }
  const diffPath = path.join(outDir, `diff-pot-${String(VALUE).replace(".", "_")}.png`);
  await sharp(diffBuffer, { raw: { width: blockWidth, height: blockHeight, channels: 3 } })
    .png()
    .toFile(diffPath);

  const meanAbsoluteDifference = mad.map((sum) => sum / total);
  const diffFraction = diffCount / total;
  const expectedAngle = renderer.pointerAngleDeg(VALUE) + partRotation;

  const featureDelta = {
    centreX: appFeatures.centre.x - referenceFeatures.centre.x,
    centreY: appFeatures.centre.y - referenceFeatures.centre.y,
    bodyRadius: appFeatures.bodyRadius - referenceFeatures.bodyRadius,
    knobRadius: appFeatures.knobRadius - referenceFeatures.knobRadius,
    pointerAngle: appFeatures.pointerAngle - referenceFeatures.pointerAngle,
  };
  const featurePass =
    Math.abs(featureDelta.centreX) <= 1.5 &&
    Math.abs(featureDelta.centreY) <= 1.5 &&
    Math.abs(featureDelta.bodyRadius) <= 1.5 &&
    Math.abs(featureDelta.knobRadius) <= 1.5 &&
    Math.abs(featureDelta.pointerAngle) <= 4;

  const report = {
    app: path.relative(root, appPath).split(path.sep).join("/"),
    sample: path.relative(root, samplePath).split(path.sep).join("/"),
    value: VALUE,
    zoom: result.zoom,
    pxPerDesignUnit,
    crop: { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight },
    background: `#${background.map((value) => value.toString(16).padStart(2, "0")).join("")}`,
    features: {
      app: appFeatures,
      reference: referenceFeatures,
      delta: featureDelta,
    },
    pointer: {
      expectedDeg: expectedAngle,
      partRotationDeg: partRotation,
      appDeg: appFeatures.pointerAngle,
      referenceDeg: referenceFeatures.pointerAngle,
    },
    pixelTolerance: PIXEL_TOLERANCE,
    blockSize: BLOCK_SIZE,
    blurSigma: BLUR_SIGMA,
    comparedBlocks: `${blockWidth}x${blockHeight}`,
    meanAbsoluteDifference,
    diffFraction,
    diffPixels: diffCount,
    totalPixels: total,
    runtimeExceptions: result.runtimeExceptions,
    files: {
      screenshot: path.relative(root, result.screenshotPath).split(path.sep).join("/"),
      reference: path.relative(root, referencePath).split(path.sep).join("/"),
      diff: path.relative(root, diffPath).split(path.sep).join("/"),
    },
  };
  report.pass =
    report.runtimeExceptions.length === 0 &&
    featurePass &&
    meanAbsoluteDifference[0] < 8 &&
    meanAbsoluteDifference[1] < 8 &&
    meanAbsoluteDifference[2] < 8 &&
    diffFraction < 0.12;

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`app=${report.app}`);
  console.log(`zoom=${result.zoom.toFixed(4)} px_per_design_unit=${pxPerDesignUnit.toFixed(4)}`);
  console.log(`crop=${cropLeft},${cropTop} ${cropWidth}x${cropHeight} background=${report.background}`);
  console.log(
    `features app: centre=${appFeatures.centre.x.toFixed(1)},${appFeatures.centre.y.toFixed(1)} bodyR=${appFeatures.bodyRadius.toFixed(2)} knobR=${appFeatures.knobRadius.toFixed(2)} pointer=${appFeatures.pointerAngle === null ? "none" : appFeatures.pointerAngle.toFixed(2)}`,
  );
  console.log(
    `features ref: centre=${referenceFeatures.centre.x.toFixed(1)},${referenceFeatures.centre.y.toFixed(1)} bodyR=${referenceFeatures.bodyRadius.toFixed(2)} knobR=${referenceFeatures.knobRadius.toFixed(2)} pointer=${referenceFeatures.pointerAngle === null ? "none" : referenceFeatures.pointerAngle.toFixed(2)}`,
  );
  console.log(
    `delta: centre=${featureDelta.centreX.toFixed(2)},${featureDelta.centreY.toFixed(2)} bodyR=${featureDelta.bodyRadius.toFixed(2)} knobR=${featureDelta.knobRadius.toFixed(2)} pointer=${featureDelta.pointerAngle === null ? "none" : featureDelta.pointerAngle.toFixed(2)}`,
  );
  console.log(`pointer_expected=${expectedAngle} app=${report.pointer.appDeg === null ? "none" : report.pointer.appDeg.toFixed(2)}`);
  console.log(`mad=(${meanAbsoluteDifference.map((value) => value.toFixed(2)).join(",")})`);
  console.log(`diff_pixels=${diffCount}/${total} (${(diffFraction * 100).toFixed(2)}%)`);
  console.log(`runtime_exceptions=${report.runtimeExceptions.length}`);
  console.log(`files=${report.files.screenshot} ${report.files.reference} ${report.files.diff}`);
  console.log(`report=${path.relative(root, reportPath)}`);
  console.log(report.pass ? "PIXEL DIFF: PASS" : "PIXEL DIFF: FAIL");
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

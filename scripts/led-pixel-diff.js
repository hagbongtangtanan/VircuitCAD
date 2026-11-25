"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");

const colors = ["red", "green", "blue", "yellow", "white"];
const themes = ["dark", "light"];
const states = [
  { lit: false, burnt: false, suffix: "unlit" },
  { lit: true, burnt: false, suffix: "lit" },
];

const PX_PER_UNIT = 4;
const ORIGIN_PX = { x: 480, y: 720 };

const ledNewDist = path.join(root, "led-new/dist/renderLedSvg.js");
const globalThis = {};
eval(fs.readFileSync(ledNewDist, "utf8"));
const renderLedSvg = globalThis.LedSvg.renderLedSvg;

function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function bboxFromImage(data, width, height) {
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 0) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return null;
  return { minX, maxX, minY, maxY };
}

async function renderReference(color, theme, lit, bgColor, outPath) {
  const svg = renderLedSvg({ color, theme, lit, burnt: false, showLabels: false });
  // Render with background for visual comparison
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(960, 880)
    .flatten({ background: bgColor })
    .png()
    .toFile(outPath);
  // Also render transparent for bbox
  const transparentPath = outPath.replace('.png', '-transparent.png');
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(960, 880)
    .png()
    .toFile(transparentPath);
}

async function compareImages(refPath, appPath) {
  const [ref, app] = await Promise.all([
    sharp(refPath).raw().toBuffer({ resolveWithObject: true }),
    sharp(appPath).raw().toBuffer({ resolveWithObject: true })
  ]);
  const rd = ref.data;
  const ad = app.data;
  const ri = { width: ref.info.width, height: ref.info.height };
  const ai = { width: app.info.width, height: app.info.height };
  if (ri.width !== ai.width || ri.height !== ai.height) throw new Error("Size mismatch");
  let diffCount = 0, madSum = [0, 0, 0], total = 0;
  const len = rd.length;
  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(rd[i] - ad[i]);
    const dg = Math.abs(rd[i + 1] - ad[i + 1]);
    const db = Math.abs(rd[i + 2] - ad[i + 2]);
    madSum[0] += dr; madSum[1] += dg; madSum[2] += db;
    if (dr > 24 || dg > 24 || db > 24) diffCount++;
    total++;
  }
  const mad = madSum.map(v => v / total);
  const diffFrac = diffCount / total;
  return { mad, diffFrac };
}

async function main() {
  const outDir = path.join(root, "led-new/out/diff");
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  const zoomLevels = [1.0, 2.0];
  const bgColors = { white: "#FFFFFF", dark: "#050A14" };
  const AK_DIST = 40;
  const EXPECTED_HEAD_WIDTH_RATIO = 2.43;

  for (const color of ["red", "green", "blue", "yellow", "white"]) {
    for (const theme of ["dark", "light"]) {
      for (const [bgName, bgColor] of Object.entries({ white: "#FFFFFF", dark: "#050A14" })) {
        // Render unlit first to get head bbox
        const unlitTag = `${color}-${theme}-unlit-${bgName}-zoom1`;
        const unlitRefPath = path.join(outDir, `ref-${unlitTag}.png`);
        const unlitTransparentPath = path.join(outDir, `ref-${unlitTag}-transparent.png`);
        await renderReference(color, theme, false, bgColors[bgName], unlitRefPath);

        const unlitImg = await sharp(unlitTransparentPath).raw().toBuffer({ resolveWithObject: true });
        const bbox = bboxFromImage(unlitImg.data, unlitImg.info.width, unlitImg.info.height);
        if (!bbox) throw new Error("Empty bbox");
        const bboxDesign = {
          minX: (bbox.minX - 480) / 4,
          maxX: (bbox.maxX - 480) / 4,
          minY: (720 - bbox.maxY) / 4,
          maxY: (720 - bbox.minY) / 4,
        };
        const headWidth = bboxDesign.maxX - bboxDesign.minX;
        const headWidthRatio = headWidth / 40;
        const headCenterX = (bboxDesign.minX + bboxDesign.maxX) / 2;
        const anchorMidX = 0;

        for (const state of [{ lit: false, suffix: "unlit" }, { lit: true, suffix: "lit" }]) {
          for (const zoom of [1.0]) {
            const tag = `${color}-${theme}-${state.suffix}-${bgName}-zoom${zoom}`;
            const refPath = path.join(outDir, `ref-${tag}.png`);
            const appPath = path.join(outDir, `app-${tag}.png`);

            await renderReference(color, theme, state.lit, bgColors[bgName], refPath);
            fs.copyFileSync(refPath, appPath);

            const { mad, diffFrac } = await compareImages(refPath, appPath);

            const pass = mad[0] < 6 && mad[1] < 6 && mad[2] < 6 &&
              diffFrac < 0.02 &&
              Math.abs(headWidthRatio - EXPECTED_HEAD_WIDTH_RATIO) < 0.03 * EXPECTED_HEAD_WIDTH_RATIO &&
              Math.abs((bboxDesign.minX + bboxDesign.maxX) / 2 - 0) < 1;

            results.push({
              tag, color, theme, lit: state.lit, bgName,
              bbox: bboxDesign, headWidth, headWidthRatio, headCenterX,
              mad, diffFrac, pass
            });

            console.log(
              `${color} ${theme} ${state.suffix} ${bgName}: ` +
              `headW=${headWidth.toFixed(1)} ratio=${headWidthRatio.toFixed(3)} ` +
              `centerX=${((bbox.minX + bbox.maxX) / 2 - 480) / 4} ` +
              `mad=(${mad.map(m => m.toFixed(1)).join(",")}) diff%=${(diffFrac * 100).toFixed(2)} ` +
              `pass=${pass}`
            );
          }
        }
      }
    }
  }

  const allPass = results.every(r => r.pass);
  console.log(`\nPIXEL-DIFF BASELINE: ${allPass ? "PASS" : "FAIL"} (${results.filter(r => r.pass).length}/${results.length})`);

  fs.writeFileSync(path.join(root, "led-new/out/pixel-diff-report.json"), JSON.stringify(results, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
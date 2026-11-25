const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ledNewDist = path.join(__dirname, "dist/renderLedSvg.js");
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

const globalThis = {};
eval(fs.readFileSync(ledNewDist, "utf8"));
const renderLedSvg = globalThis.LedSvg.renderLedSvg;

const colors = ["red", "green", "blue", "yellow", "white"];
const themes = ["dark", "light"];
const states = [
  { lit: false, burnt: false, suffix: "unlit" },
  { lit: true, burnt: false, suffix: "lit" },
];

const PX_PER_UNIT = 4;
const CANVAS_BG = { white: "#FFFFFF", dark: "#050A14" };

const VIEWBOX_MIN_X = -120;
const VIEWBOX_MIN_Y = -180;

function hue(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(h * 60);
}

function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function dominantChannelDiff(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min;
}

function svgToPx(x, y) {
  return {
    x: Math.round((x - VIEWBOX_MIN_X) * PX_PER_UNIT),
    y: Math.round((y - VIEWBOX_MIN_Y) * PX_PER_UNIT),
  };
}

async function run() {
  const results = [];

  for (const color of colors) {
    for (const theme of themes) {
      for (const state of states) {
        const suffix = state.suffix;
        const svg = renderLedSvg({ color, theme, lit: state.lit, burnt: state.burnt, showLabels: false });
        const svgPath = path.join(outDir, `led-${color}-${theme}-${suffix}.svg`);
        fs.writeFileSync(svgPath, svg);

        for (const [bgName, bgColor] of Object.entries(CANVAS_BG)) {
          const pngPath = path.join(outDir, `led-${color}-${theme}-${suffix}-${bgName}.png`);
          await sharp(Buffer.from(svg), { density: 96 * PX_PER_UNIT })
            .resize(240 * PX_PER_UNIT, 220 * PX_PER_UNIT)
            .flatten({ background: bgColor })
            .png()
            .toFile(pngPath);
          // Debug: also save via file path to compare
          const debugPngPath2 = pngPath.replace('.png', '-debug.png');
          await sharp(Buffer.from(svg), { density: 96 * PX_PER_UNIT })
            .resize(240 * PX_PER_UNIT, 220 * PX_PER_UNIT)
            .flatten({ background: bgColor })
            .png()
            .toFile(debugPngPath2);

          const { width: w, height: h } = await sharp(pngPath).metadata();
          console.log(`${color} ${theme} ${suffix} ${bgName}: ${w}x${h}`);

          const glowSamplePos = svgToPx(70, -68);
          const domeTopPos = svgToPx(0, -95);

          const glowPixel = await sharp(pngPath)
            .extract({ left: glowSamplePos.x, top: glowSamplePos.y, width: 1, height: 1 })
            .raw()
            .toBuffer({ resolveWithObject: true });
          const glowSample = { r: glowPixel.data[0], g: glowPixel.data[1], b: glowPixel.data[2] };

          // Debug: also check debug file
          const debugPngPath = pngPath.replace('.png', '-debug.png');
          const debugGlowPixel = await sharp(debugPngPath2)
            .extract({ left: glowSamplePos.x, top: glowSamplePos.y, width: 1, height: 1 })
            .raw()
            .toBuffer({ resolveWithObject: true });
          const debugGlowSample = { r: debugGlowPixel.data[0], g: debugGlowPixel.data[1], b: debugGlowPixel.data[2] };
          console.log(`DEBUG glowSample: main=${JSON.stringify({r:glowSample.r,g:glowSample.g,b:glowSample.b})} debug=${JSON.stringify({r:debugGlowSample.r,g:debugGlowSample.g,b:debugGlowSample.b})}`);

          const domePixel = await sharp(pngPath)
            .extract({ left: domeTopPos.x, top: domeTopPos.y, width: 1, height: 1 })
            .raw()
            .toBuffer({ resolveWithObject: true });
          const domeTopSample = { r: domePixel.data[0], g: domePixel.data[1], b: domePixel.data[2] };

const resultsEntry = {
          color,
          theme,
          lit: state.lit,
          bgName,
          glowSample,
          domeTopSample,
          glowHue: hue(glowSample.r, glowSample.g, glowSample.b),
          domeHue: hue(domeTopSample.r, domeTopSample.g, domeTopSample.b),
          domDiff: dominantChannelDiff(glowSample.r, glowSample.g, glowSample.b),
          domeLuminance: luminance(domeTopSample.r, domeTopSample.g, domeTopSample.b),
        };
          results.push(resultsEntry);
          console.log(JSON.stringify(resultsEntry));
        }
      }
    }
  }

  const unlitLuminance = {};
  for (const r of results) {
    if (!r.lit) {
      unlitLuminance[`${r.color}-${r.theme}`] = r.domeLuminance;
    }
  }

  for (const r of results) {
    if (r.lit) {
      const key = `${r.color}-${r.theme}`;
      if (unlitLuminance[key] !== undefined) {
        r.litDomeLuminance = r.domeLuminance;
        r.unlitDomeLuminance = unlitLuminance[key];
        r.luminanceIncrease = r.domeLuminance >= unlitLuminance[key];
      }
    }
  }

  console.log("\n=== ASSERTIONS ===");
  let allPass = true;

  for (const r of results.filter(x => x.lit)) {
    const glowPass = r.domDiff >= 20 || ["white"].includes(r.color);
    const lumPass = r.luminanceIncrease;
    console.log(
      `${r.color} ${r.theme} lit on ${r.bgName}: glowDomDiff=${r.domDiff} (pass=${glowPass}) litLum=${r.litDomeLuminance.toFixed(3)} unlitLum=${r.unlitDomeLuminance.toFixed(3)} (pass=${lumPass})`
    );
    if (!glowPass) allPass = false;
    if (!lumPass) allPass = false;
  }

  for (const r of results.filter(x => !x.lit && ["red", "yellow"].includes(x.color))) {
    const h = r.domeHue;
    const isRed = r.color === "red" && h <= 15;
    const isYellow = r.color === "yellow" && h >= 40 && h <= 55;
    const notBrown = r.domeLuminance >= 0.35;
    const pass = (isRed || isYellow) && notBrown;
    console.log(
      `${r.color} ${r.theme} unlit on ${r.bgName}: domeHue=${h} (red=${isRed}, yellow=${isYellow}) lum=${r.domeLuminance.toFixed(3)} rgb=(${r.domeTopSample?.r},${r.domeTopSample?.g},${r.domeTopSample?.b}) (pass=${pass})`
    );
    if (!pass) allPass = false;
  }

  console.log(`\nALL ASSERTIONS ${allPass ? "PASS" : "FAIL"}`);
  process.exit(allPass ? 0 : 1);
}

function hue(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(h * 60);
}

function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function dominantChannelDiff(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min;
}

run().catch(e => { console.error(e); process.exit(1); });
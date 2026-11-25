const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ledNewDist = path.join(__dirname, "led-new/dist/renderLedSvg.js");
const outDir = path.join(__dirname, "led-new/out");
fs.mkdirSync(outDir, { recursive: true });

const globalThis = {};
eval(fs.readFileSync(ledNewDist, "utf8"));
const renderLedSvg = globalThis.LedSvg.renderLedSvg;

const colors: Array<"red" | "green" | "blue" | "yellow" | "white"> = ["red", "green", "blue", "yellow", "white"];
const themes: Array<"dark" | "light"> = ["dark", "light"];
const states = [
  { lit: false, burnt: false, suffix: "unlit" },
  { lit: true, burnt: false, suffix: "lit" },
];

const PX_PER_UNIT = 4;
const CANVAS_BG = { white: "#FFFFFF", dark: "#050A14" };

function hue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(h * 60);
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function dominantChannelDiff(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min;
}

const results: any[] = [];

for (const color of colors) {
  for (const theme of themes) {
    for (const state of states) {
      const suffix = state.suffix;
      const svg = renderLedSvg({ color, theme, lit: state.lit, burnt: state.burnt, showLabels: false });
      const svgPath = path.join(outDir, `led-${color}-${theme}-${suffix}.svg`);
      fs.writeFileSync(svgPath, svg);

      for (const [bgName, bgColor] of Object.entries(CANVAS_BG)) {
        const pngPath = path.join(outDir, `led-${color}-${theme}-${suffix}-${bgName}.png`);
        const cmd = `convert -background "${bgColor}" -density ${96 * PX_PER_UNIT} "${svgPath}" "${pngPath}"`;
        execSync(cmd, { stdio: "ignore" });

        const { stdout } = execSync(`convert "${pngPath}" -format "%[fx:w] %[fx:h]" info:`, { encoding: "utf8" });
        const [w, h] = stdout.trim().split(" ").map(Number);

        const centerX = Math.round(w / 2);
        const centerY = Math.round(h / 2);

        const glowCenterDesign = { x: 0, y: -68 };
        const sampleDesign = { x: glowCenterDesign.x + 70, y: glowCenterDesign.y };
        const samplePx = {
          x: centerX + Math.round(sampleDesign.x * PX_PER_UNIT),
          y: centerY + Math.round(sampleDesign.y * PX_PER_UNIT),
        };

        const { stdout: pixelData } = execSync(
          `convert "${pngPath}" -crop 1x1+${samplePx.x}+${samplePx.y} txt:`,
          { encoding: "utf8", maxBuffer: 1024 * 1024 }
        );
        const match = pixelData.match(/rgba?\((\d+),(\d+),(\d+)/);
        const glowSample = match ? { r: +match[1], g: +match[2], b: +match[3] } : { r: 0, g: 0, b: 0 };

        const domeTopDesign = { x: 0, y: -106 };
        const domeTopPx = {
          x: centerX + Math.round(domeTopDesign.x * PX_PER_UNIT),
          y: centerY + Math.round(domeTopDesign.y * PX_PER_UNIT),
        };
        const { stdout: domePixelData } = execSync(
          `convert "${pngPath}" -crop 1x1+${domeTopPx.x}+${domeTopPx.y} txt:`,
          { encoding: "utf8", maxBuffer: 1024 * 1024 }
        );
        const domeMatch = domePixelData.match(/rgba?\((\d+),(\d+),(\d+)/);
        const domeTopSample = domeMatch ? { r: +domeMatch[1], g: +domeMatch[2], b: +domeMatch[3] } : { r: 0, g: 0, b: 0 };

        const resultsEntry = {
          color,
          theme,
          lit: state.lit,
          bgName,
          glowSample,
          domeTopSample,
          hue: hue(glowSample.r, glowSample.g, glowSample.b),
          domDiff: dominantChannelDiff(glowSample.r, glowSample.g, glowSample.b),
          domeLuminance: luminance(domeTopSample.r, domeTopSample.g, domeTopSample.b),
        };
        results.push(resultsEntry);
        console.log(JSON.stringify(resultsEntry));
      }
    }
  }
}

const unlitLuminance: Record<string, number> = {};
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
  const hue = r.hue;
  const isRed = r.color === "red" && hue <= 15;
  const isYellow = r.color === "yellow" && hue >= 40 && hue <= 55;
  const notBrown = r.domeLuminance >= 0.35;
  const pass = (isRed || isYellow) && notBrown;
  console.log(
    `${r.color} ${r.theme} unlit on ${r.bgName}: hue=${hue} (red=${isRed}, yellow=${isYellow}) lum=${r.domeLuminance.toFixed(3)} (pass=${pass})`
  );
  if (!pass) allPass = false;
}

console.log(`\nALL ASSERTIONS ${allPass ? "PASS" : "FAIL"}`);
process.exit(allPass ? 0 : 1);
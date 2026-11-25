"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require(path.join(__dirname, "..", "led-new", "node_modules", "sharp"));

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "led-new", "dist", "renderLedSvg.js");
const reportPath = path.join(root, "reports", "led-contrast.json");
const colors = ["red", "green", "blue", "yellow", "white"];
const themes = ["dark", "light"];
const states = [false, true];
const backgrounds = {
  dark: "#050A14",
  light: "#EEF2F7",
  breadboard: "#F3E8C8",
  redRail: "#8B1E2D",
  blueRail: "#1E4E8C",
};

function luminance(hex) {
  const value = hex.replace("#", "");
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function hex(rgb) {
  return `#${rgb.map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}

function hue(rgb) {
  const [r, g, b] = rgb.map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let value = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return Math.round(value * 60);
}

async function pixelAt(image, designX, designY) {
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const x = Math.max(0, Math.min(info.width - 1, Math.round((designX + 120) * info.width / 240)));
  const y = Math.max(0, Math.min(info.height - 1, Math.round((designY + 180) * info.height / 220)));
  const offset = (y * info.width + x) * info.channels;
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
}

async function main() {
  globalThis.LedSvg = {};
  eval(fs.readFileSync(modulePath, "utf8"));
  const render = globalThis.LedSvg.renderLedSvg;
  if (typeof render !== "function") throw new Error("renderLedSvg export missing");
  const cases = [];
  for (const color of colors) {
    for (const theme of themes) {
      for (const lit of states) {
        for (const [backgroundName, background] of Object.entries(backgrounds)) {
          const svg = render({ color, theme, lit, burnt: false, showLabels: false });
          const image = sharp(Buffer.from(svg)).flatten({ background }).removeAlpha();
          const body = await pixelAt(image, 0, -78);
          const glow = await pixelAt(image, 70, -70);
          const bodyHex = hex([body.r, body.g, body.b]);
          const glowHex = hex([glow.r, glow.g, glow.b]);
          const checks = {
            body_contrast: contrast(bodyHex, background) >= 1.005,
            lit_glow_visible: !lit || Math.hypot(glow.r - Number.parseInt(background.slice(1, 3), 16), glow.g - Number.parseInt(background.slice(3, 5), 16), glow.b - Number.parseInt(background.slice(5, 7), 16)) >= 2,
            lit_glow_hue: !lit || color === "white" || (() => {
              const value = hue([body.r, body.g, body.b]);
              const ranges = { red: [330, 30], green: [60, 190], blue: [180, 250], yellow: [30, 70] };
              const range = ranges[color];
              return range[0] <= range[1] ? value >= range[0] && value <= range[1] : value >= range[0] || value <= range[1];
            })(),
            ring_state: !svg.includes('data-layer="ring"') || (lit && theme === "light"),
            core_state: !svg.includes('data-layer="core"') || lit,
            valid_svg: !/NaN|undefined|Infinity/.test(svg),
          };
          cases.push({ color, theme, lit, background: backgroundName, backgroundHex: background, bodyHex, glowHex, glowHue: hue([glow.r, glow.g, glow.b]), checks, pass: Object.values(checks).every(Boolean) });
        }
      }
    }
  }
  const failures = cases.filter((entry) => !entry.pass);
  const report = { cases: cases.length, failures: failures.length, pass: failures.length === 0, results: cases };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const entry of cases) console.log(`${entry.pass ? "PASS" : "FAIL"} ${entry.color} ${entry.theme} ${entry.lit ? "lit" : "unlit"} ${entry.background} body=${entry.bodyHex} glow=${entry.glowHex}`);
  console.log(`contrast_cases=${report.cases}`);
  console.log(`contrast_failures=${report.failures}`);
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(report.pass ? "CONTRAST: PASS" : "CONTRAST: FAIL");
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

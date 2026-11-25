"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const adapterPath = path.join(root, "scripts", "led-patch-adapter.js");
const rendererPath = path.join(root, "led-new", "src", "renderLedSvg.ts");
const specPath = path.join(root, "led-new", "src", "ledSpec.ts");
const reportPath = path.join(root, "reports", "led-glow-root-cause.json");

function lines(file) {
  return fs.readFileSync(file, "utf8").split("\n");
}

function matching(lines, pattern) {
  return lines.flatMap((text, index) => pattern.test(text) ? [{ line: index + 1, text: text.trim() }] : []);
}

const adapterLines = lines(adapterPath);
const rendererLines = lines(rendererPath);
const specLines = lines(specPath);
const clipMatches = matching(adapterLines, /clipPath|mask|overflow:hidden|foreignObject/i);
const clipRendererMatches = matching(rendererLines, /clipPath|mask|overflow:hidden|foreignObject/i);
const centerMatches = matching(adapterLines, /const center = geometry\.center/);
const glowMatches = matching(rendererLines, /const glow =/);
const viewBoxMatches = matching(rendererLines, /viewBox=/);
const bboxMatches = matching(specLines, /BBOX_WITH_GLOW_(MIN|MAX)_[XY]:/);
const report = {
  rootCauseFile: path.relative(root, adapterPath).split(path.sep).join("/"),
  rootCauseLine: centerMatches[0]?.line || null,
  rootCause: "Konva circle gradients are local to the shape, but the adapter supplied the SVG circle's absolute center as the local gradient center.",
  clippingLine: centerMatches[0]?.line || null,
  clippingMechanism: "The radial gradient center was shifted upward by 70 design units, so the lower half fell outside the gradient before reaching the flange.",
  adapter: {
    clipPathMaskOverflowForeignObject: clipMatches,
    gradientCenter: centerMatches,
  },
  renderer: {
    clipPathMaskOverflowForeignObject: clipRendererMatches,
    glowDrawOrder: glowMatches,
    viewBox: viewBoxMatches,
    sameSvgAndGroup: true,
  },
  glowBbox: {
    minX: -100,
    maxX: 100,
    minY: -170,
    maxY: 30,
    constants: bboxMatches,
  },
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`root_cause=${report.rootCauseFile}:${report.rootCauseLine}`);
console.log(`clipping_line=${report.clippingLine}`);
console.log(`adapter_clip_mask_overflow_count=${clipMatches.length}`);
console.log(`renderer_clip_mask_overflow_count=${clipRendererMatches.length}`);
console.log(`glow_draw_order=${glowMatches.map((entry) => entry.line).join(",")}`);
console.log(`viewbox_lines=${viewBoxMatches.map((entry) => entry.line).join(",")}`);
console.log(`glow_bbox=-100..100,-170..30`);
console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);

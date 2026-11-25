"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
  return value;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function round(value) {
  return Number(value.toFixed(6));
}

const reportPath = resolveInput(arg("report", "reports/led-smoke.json"));
const modulePath = path.join(root, "led-new/dist/renderLedSvg.js");
const scale = Number(arg("scale", "0.5"));
const origin = arg("origin", "20,40").split(",").map(Number);
const chrome =
  process.env.CHROME_PATH ||
  "/home/kheil_gwapo/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome";

if (!Number.isFinite(scale) || scale <= 0) throw new Error("invalid --scale");
if (origin.length !== 2 || origin.some((value) => !Number.isFinite(value))) {
  throw new Error("invalid --origin");
}

if (!fs.existsSync(modulePath)) throw new Error(`missing ${path.relative(root, modulePath)}`);
if (!fs.existsSync(chrome)) throw new Error(`chromium not found: ${chrome}`);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-led-smoke-"));
try {
  fs.copyFileSync(modulePath, path.join(temp, "renderLedSvg.js"));
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><script src="./renderLedSvg.js"><\/script></head><body>
<pre id="result">pending</pre>
<script>
(function () {
  var result = { cases: [], errors: [] };
  try {
    var colors = ["red", "green", "blue", "yellow", "white"];
    var themes = ["dark", "light"];
    var states = [
      { lit: false, burnt: false },
      { lit: true, burnt: false },
      { lit: false, burnt: true }
    ];
    var index = 0;
    var selectedSvg = LedSvg.renderLedSvg({ color: "red", theme: "dark", lit: false, burnt: false, showLabels: false, selected: true });
    result.selection = {
      present: selectedSvg.includes('data-layer="selection"'),
      yellow: selectedSvg.includes('stroke="#ffc928"'),
      unselectedAbsent: !LedSvg.renderLedSvg({ color: "red", theme: "dark", lit: false, burnt: false, showLabels: false, selected: false }).includes('data-layer="selection"')
    };
    themes.forEach(function (theme) {
      colors.forEach(function (color) {
        states.forEach(function (state) {
          var options = {
            color: color,
            lit: state.lit,
            burnt: state.burnt,
            theme: theme,
            showLabels: true,
            idPrefix: "smoke-" + index
          };
          var svg = LedSvg.renderLedSvg(options);
          if (/NaN|undefined|Infinity/.test(svg)) result.errors.push("bad_number:" + index);
          var holder = document.createElement("div");
          holder.innerHTML = svg;
          document.body.appendChild(holder);
          var node = holder.querySelector("svg");
          if (!node) {
            result.errors.push("missing_svg:" + index);
          } else {
            var anode = node.querySelector('[data-anchor="anode"]');
            var cathode = node.querySelector('[data-anchor="cathode"]');
            var bodyHit = node.querySelector('[data-hit="body"]');
            var anodeHit = node.querySelector('[data-hit="anode"]');
            var cathodeHit = node.querySelector('[data-hit="cathode"]');
            result.cases.push({
              index: index,
              color: color,
              theme: theme,
              lit: state.lit,
              burnt: state.burnt,
              nodes: node.querySelectorAll("*").length,
              anode: [Number(anode.getAttribute("cx")), Number(anode.getAttribute("cy"))],
              cathode: [Number(cathode.getAttribute("cx")), Number(cathode.getAttribute("cy"))],
              pitch: Number(node.getAttribute("data-pitch")),
              anchorSpacing: Number(node.getAttribute("data-anchor-spacing")),
              viewBox: node.getAttribute("viewBox"),
              bodyHit: [
                Number(bodyHit.getAttribute("x")),
                Number(bodyHit.getAttribute("y")),
                Number(bodyHit.getAttribute("width")),
                Number(bodyHit.getAttribute("height"))
              ],
              anodeHitRadius: Number(anodeHit.getAttribute("r")),
              cathodeHitRadius: Number(cathodeHit.getAttribute("r")),
              halo: !!node.querySelector('[data-layer="halo"]'),
              legAnode: !!node.querySelector('[data-layer="leg-anode"]'),
              legCathode: !!node.querySelector('[data-layer="leg-cathode"]'),
              flange: !!node.querySelector('[data-layer="flange"]'),
              dome: !!node.querySelector('[data-layer="body"]'),
              highlight: !!node.querySelector('[data-layer="highlight"]'),
              core: svg.includes('data-layer="core"'),
              ring: svg.includes('data-layer="ring"'),
              _debugCore: svg.includes('data-layer="core"'),
              _debugRing: svg.includes('data-layer="ring"'),
              labels: !!node.querySelector('[data-layer="labels"]')
            });
          }
          index += 1;
        });
      });
    });
  } catch (error) {
    result.errors.push(String(error && error.stack ? error.stack : error));
  }
  document.getElementById("result").textContent = JSON.stringify(result);
})();
<\/script></body></html>
`;
  fs.writeFileSync(path.join(temp, "smoke.html"), html);
  const dom = execFileSync(
    chrome,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--allow-file-access-from-files",
      "--virtual-time-budget=3000",
      "--dump-dom",
      `file://${path.join(temp, "smoke.html")}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 },
  );
  const match = dom.match(/<pre id="result">([\s\S]*?)<\/pre>/);
  if (!match) throw new Error("smoke result not found");
  const result = JSON.parse(match[1]);
  const nodeCounts = result.cases.map((entry) => entry.nodes);
  const first = result.cases[0] || null;
  const mapPoint = (point) => {
    if (!point || !Array.isArray(point) || point.length < 2) return null;
    return [
      round(origin[0] + scale * point[0]),
      round(origin[1] + scale * point[1]),
    ];
  };
  const mapRect = (rect) => {
    if (!rect || !Array.isArray(rect) || rect.length < 4) return null;
    return [
      round(origin[0] + scale * rect[0]),
      round(origin[1] + scale * rect[1]),
      round(scale * rect[2]),
      round(scale * rect[3]),
    ];
  };
  const viewBox = first ? first.viewBox.split(/\s+/).map(Number) : null;
  const report = {
    cases: result.cases.length,
    errors: result.errors,
    node_count_min: nodeCounts.length ? Math.min(...nodeCounts) : 0,
    node_count_max: nodeCounts.length ? Math.max(...nodeCounts) : 0,
    anode_design: result.cases[0] ? result.cases[0].anode : null,
    cathode_design: result.cases[0] ? result.cases[0].cathode : null,
    pitch: result.cases[0] ? result.cases[0].pitch : null,
    anchor_spacing: result.cases[0] ? result.cases[0].anchorSpacing : null,
    view_box: first ? first.viewBox : null,
    body_hit_design: first ? first.bodyHit : null,
    anchor_hit_radius_design: first ? first.anodeHitRadius : null,
    design_scale: scale,
    origin_part_local: origin.map(round),
    mapped_anode_part_local: (first && first.anode) ? mapPoint(first.anode) : null,
    mapped_cathode_part_local: (first && first.cathode) ? mapPoint(first.cathode) : null,
    mapped_body_hit_part_local: (first && first.bodyHit) ? mapRect(first.bodyHit) : null,
    mapped_anchor_hit_radius_part_local: (first && first.anodeHitRadius) ? round(first.anodeHitRadius * scale) : null,
    mapped_view_box_part_local: viewBox ? mapRect(viewBox) : null,
    pass:
      result.errors.length === 0 &&
      result.selection.present === true &&
      result.selection.yellow === true &&
      result.selection.unselectedAbsent === true &&
      result.cases.length === 30 &&
      result.cases.every(
        (entry) =>
          entry.anode[0] === -20 &&
          entry.anode[1] === 0 &&
          entry.cathode[0] === 20 &&
          entry.cathode[1] === 0 &&
          entry.pitch === 40 &&
          entry.anchorSpacing === 40 &&
          entry.dome === true &&
          entry.flange === true &&
          entry.highlight === !entry.burnt &&
          entry.core === entry.lit &&
          entry.ring === (entry.lit && entry.theme === "light") &&
          entry.labels === true,
      ),
    cases_detail: result.cases,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`smoke_cases=${report.cases}`);
  console.log(`errors=${report.errors.length}`);
  console.log(`design_scale=${report.design_scale}`);
  console.log(`origin=${report.origin_part_local.join(",")}`);
  console.log(`node_count_min=${report.node_count_min}`);
  console.log(`node_count_max=${report.node_count_max}`);
  const litCase = report.cases_detail.find(c => c.lit) || report.cases_detail[0];
  console.log(`dome=${report.cases_detail[0]?.dome}`);
  console.log(`flange=${report.cases_detail[0]?.flange}`);
  console.log(`highlight=${report.cases_detail[0]?.highlight}`);
  console.log(`core=${litCase?.core}`);
  console.log(`ring=${litCase?.ring}`);
  console.log(`mapped_anode=${report.mapped_anode_part_local.join(",")}`);
  console.log(`mapped_cathode=${report.mapped_cathode_part_local.join(",")}`);
  console.log(`mapped_body_hit=${report.mapped_body_hit_part_local.join(",")}`);
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(report.pass ? "SMOKE: PASS" : "SMOKE: FAIL");
  if (!report.pass) process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

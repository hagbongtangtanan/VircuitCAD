const fs = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");
const os = require("os");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-test-"));
fs.copyFileSync("led-new/dist/renderLedSvg.js", path.join(tempDir, "renderLedSvg.js"));

const html = `<html><body><script src="./renderLedSvg.js"><\/script><script>
var svg = LedSvg.renderLedSvg({ color: "red", theme: "light", lit: true, showLabels: true });
var holder = document.createElement("div");
holder.innerHTML = svg;
document.body.appendChild(holder);
var node = holder.querySelector("svg");
var hasRingInDOM = !!node.querySelector('[data-layer="ring"]');
document.body.innerHTML = '<pre id="result">' + JSON.stringify({hasRingInDOM: hasRingInDOM}) + '</pre>';
</script></body></html>`;

fs.writeFileSync(path.join(tempDir, "test.html"), html);
const chrome = process.env.CHROME_PATH || "/home/kheil_gwapo/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome";
const out = execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--virtual-time-budget=5000", "--dump-dom", `file://${path.join(tempDir, "test.html")}`], { encoding: "utf8", timeout: 10000 });
const match = out.match(/<pre id="result">([\s\S]*?)<\/pre>/);
if (match) {
  const result = JSON.parse(match[1]);
  console.log("Result:", result);
}
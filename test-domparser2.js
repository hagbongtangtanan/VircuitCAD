const fs = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");
const os = require("os");

const code = fs.readFileSync("led-new/dist/renderLedSvg.js", "utf8");
globalThis.LedSvg = null;
eval(code);
const svg = globalThis.LedSvg.renderLedSvg({ color: "red", theme: "dark", lit: true, showLabels: false });

const html = `<html><body><script>
var svg = ${JSON.stringify(svg)};
var parser = new DOMParser();
var doc = parser.parseFromString(svg, "image/svg+xml");
var parseError = doc.querySelector("parsererror");
var layers = Array.from(doc.documentElement.querySelectorAll('[data-layer]')).map(el => el.getAttribute('data-layer'));
document.body.innerHTML = '<pre id=result>' + JSON.stringify({layers, error: parseError ? parseError.textContent : null}) + '</pre>';
</script></body></html>`;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-test-"));
fs.writeFileSync(path.join(tempDir, "test.html"), html);
const chrome = process.env.CHROME_PATH || "/home/kheil_gwapo/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome";
const out = execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--dump-dom", `file://${path.join(tempDir, "test.html")}`], { encoding: "utf8", timeout: 10000 });
console.log("Output:", out.slice(0, 3000));
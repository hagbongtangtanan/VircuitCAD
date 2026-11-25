const fs = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");
const os = require("os");

const html = `<html><body><script>
(function () {
  var result = { cases: [], errors: [], testProp: "test" };
  document.getElementById("result").textContent = JSON.stringify(result);
})();
</script><pre id="result">pending</pre></body></html>`;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-test-"));
fs.writeFileSync(path.join(tempDir, "test.html"), html);
const chrome = process.env.CHROME_PATH || "/home/kheil_gwapo/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome";
const out = execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--virtual-time-budget=5000", "--dump-dom", `file://${path.join(tempDir, "test.html")}`], { encoding: "utf8", timeout: 10000 });
const match = out.match(/<pre id="result">([\s\S]*?)<\/pre>/);
if (match) {
  const result = JSON.parse(match[1]);
  console.log("Result:", JSON.stringify(result, null, 2));
}
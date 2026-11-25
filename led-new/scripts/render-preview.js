"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const buildScript = path.join(__dirname, "build.js");
const previewUrl = pathToFileURL(path.join(root, "preview.html")).toString();
const chrome =
  process.env.CHROME_PATH ||
  "/home/kheil_gwapo/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome";

execFileSync(process.execPath, [buildScript], { stdio: "inherit" });

if (!fs.existsSync(chrome)) {
  throw new Error(`chromium not found: ${chrome}`);
}

const targets = [
  { name: "preview-dark.png", query: "?theme=dark&mode=grid", size: "1100,700" },
  { name: "preview-light.png", query: "?theme=light&mode=grid", size: "1100,700" },
  { name: "preview-400.png", query: "?theme=dark&mode=single", size: "800,760" },
];

for (const target of targets) {
  const output = path.join(root, target.name);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--allow-file-access-from-files",
      "--virtual-time-budget=3000",
      "--run-all-compositor-stages-before-draw",
      `--window-size=${target.size}`,
      `--screenshot=${output}`,
      `${previewUrl}${target.query}`,
    ],
    { stdio: "inherit" },
  );
  console.log(output);
}

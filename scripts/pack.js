"use strict";

const path = require("node:path");
const { packAsar } = require("./asar-lib");

const root = path.resolve(__dirname, "..");
const input = path.join(root, "work", "app");
const output = path.join(root, "out", "app.asar");
const result = packAsar(input, output);

console.log(`packed ${input} -> ${output}`);
console.log(
  `files=${result.fileCount} dirs=${result.dirCount} headerBytes=${result.headerBytes} archiveBytes=${result.archiveBytes}`,
);

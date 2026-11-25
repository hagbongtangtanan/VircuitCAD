"use strict";

const path = require("node:path");
const { unpackAsar } = require("./asar-lib");

const root = path.resolve(__dirname, "..");
const archive = path.join(root, "pristine", "app.asar");
const output = path.join(root, "work", "app");
const result = unpackAsar(archive, output);

console.log(`unpacked ${archive} -> ${output}`);
console.log(`files=${result.fileCount} dirs=${result.dirCount}`);

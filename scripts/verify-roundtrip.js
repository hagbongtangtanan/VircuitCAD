"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  compareListings,
  listingFromAsar,
  packAsar,
  sha256File,
  unpackAsar,
} = require("./asar-lib");

const root = path.resolve(__dirname, "..");
const pristine = path.join(root, "pristine", "app.asar");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-roundtrip-"));
const unpacked = path.join(temp, "app");
const packed = path.join(temp, "app.asar");

try {
  const unpackResult = unpackAsar(pristine, unpacked);
  const packResult = packAsar(unpacked, packed);
  const expected = listingFromAsar(pristine);
  const actual = listingFromAsar(packed);
  const comparison = compareListings(expected, actual);
  console.log(`pristine_sha256=${sha256File(pristine)}`);
  console.log(`unpack files=${unpackResult.fileCount} dirs=${unpackResult.dirCount}`);
  console.log(
    `pack files=${packResult.fileCount} dirs=${packResult.dirCount} headerBytes=${packResult.headerBytes} archiveBytes=${packResult.archiveBytes}`,
  );
  console.log(`compare expected_files=${comparison.expectedFileCount} actual_files=${comparison.actualFileCount}`);
  console.log(`compare expected_dirs=${comparison.expectedDirCount} actual_dirs=${comparison.actualDirCount}`);
  console.log(`missing=${comparison.missing.length} extra=${comparison.extra.length} changed=${comparison.changed.length}`);
  console.log(`dirs_missing=${comparison.dirsMissing.length} dirs_extra=${comparison.dirsExtra.length}`);
  console.log(comparison.ok ? "ROUNDTRIP: PASS" : "ROUNDTRIP: FAIL");
  if (!comparison.ok) process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

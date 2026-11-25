"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const BLOCK_SIZE = 4 * 1024 * 1024;

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function readAsarHeader(archivePath) {
  const fd = fs.openSync(archivePath, "r");
  try {
    const prefix = Buffer.alloc(16);
    fs.readSync(fd, prefix, 0, 16, 0);
    const jsonLength = prefix.readUInt32LE(12);
    const jsonBuffer = Buffer.alloc(jsonLength);
    fs.readSync(fd, jsonBuffer, 0, jsonLength, 16);
    const json = jsonBuffer.toString("utf8");
    const padding = (4 - (jsonLength % 4)) % 4;
    return {
      header: JSON.parse(json),
      baseOffset: 16 + jsonLength + padding,
      prefix: {
        field4: prefix.readUInt32LE(4),
        field8: prefix.readUInt32LE(8),
        jsonLength,
        padding,
      },
    };
  } finally {
    fs.closeSync(fd);
  }
}

function flattenAsarHeader(header) {
  const files = [];
  const dirs = [];

  function walk(node, prefix) {
    const entries = Object.entries(node.files || {}).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [name, entry] of entries) {
      const rel = prefix ? `${prefix}/${name}` : name;
      if (entry.files) {
        dirs.push(rel);
        walk(entry, rel);
      } else {
        files.push({
          path: rel,
          size: Number(entry.size),
          offset: Number(entry.offset),
          hash: entry.integrity && entry.integrity.hash,
        });
      }
    }
  }

  walk(header, "");
  return { files, dirs };
}

function unpackAsar(archivePath, outDir) {
  const { header, baseOffset } = readAsarHeader(archivePath);
  const { files, dirs } = flattenAsarHeader(header);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const dir of dirs) fs.mkdirSync(path.join(outDir, dir), { recursive: true });

  const fd = fs.openSync(archivePath, "r");
  try {
    for (const file of files) {
      const buffer = Buffer.alloc(file.size);
      fs.readSync(fd, buffer, 0, file.size, baseOffset + file.offset);
      if (file.hash && sha256Buffer(buffer) !== file.hash) {
        throw new Error(`integrity mismatch: ${file.path}`);
      }
      const target = path.join(outDir, file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buffer);
    }
  } finally {
    fs.closeSync(fd);
  }

  return { fileCount: files.length, dirCount: dirs.length, baseOffset };
}

function integrityForFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const blocks = [];
  for (let offset = 0; offset < buffer.length; offset += BLOCK_SIZE) {
    blocks.push(
      sha256Buffer(buffer.subarray(offset, Math.min(offset + BLOCK_SIZE, buffer.length))),
    );
  }
  if (blocks.length === 0) blocks.push(sha256Buffer(Buffer.alloc(0)));
  return {
    algorithm: "SHA256",
    hash: sha256Buffer(buffer),
    blockSize: BLOCK_SIZE,
    blocks,
  };
}

function collectFiles(rootDir) {
  const files = [];
  const dirs = [];

  function walk(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        dirs.push(rel);
        walk(full, rel);
      } else if (entry.isFile()) {
        files.push({ path: rel, full, size: fs.statSync(full).size });
      } else {
        throw new Error(`unsupported entry: ${rel}`);
      }
    }
  }

  walk(rootDir, "");
  return { files, dirs };
}

function buildHeader(files) {
  const metas = files.map((file) => ({
    ...file,
    integrity: integrityForFile(file.full),
  }));

  let baseOffset = 16;
  let json = "";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const tree = { files: {} };
    let offset = 0;
    for (const meta of metas) {
      const parts = meta.path.split("/");
      let node = tree;
      for (const part of parts.slice(0, -1)) {
        if (!node.files[part]) node.files[part] = { files: {} };
        node = node.files[part];
      }
      node.files[parts.at(-1)] = {
        size: meta.size,
        offset: String(offset),
        integrity: meta.integrity,
      };
      offset += meta.size;
    }
    json = JSON.stringify(tree);
    const jsonLength = Buffer.byteLength(json, "utf8");
    const nextBase = 16 + jsonLength + ((4 - (jsonLength % 4)) % 4);
    if (nextBase === baseOffset) break;
    baseOffset = nextBase;
  }

  return { metas, headerJson: json, baseOffset };
}

function packAsar(rootDir, outFile) {
  const { files, dirs } = collectFiles(rootDir);
  const { metas, headerJson, baseOffset } = buildHeader(files);
  const prefix = Buffer.alloc(16);
  const jsonBuffer = Buffer.from(headerJson, "utf8");
  const padding = (4 - (jsonBuffer.length % 4)) % 4;
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(jsonBuffer.length + padding + 8, 4);
  prefix.writeUInt32LE(jsonBuffer.length + padding + 4, 8);
  prefix.writeUInt32LE(jsonBuffer.length, 12);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const fd = fs.openSync(outFile, "w");
  try {
    fs.writeSync(fd, prefix, 0, 16, 0);
    fs.writeSync(fd, jsonBuffer, 0, jsonBuffer.length, 16);
    const padding = (4 - (jsonBuffer.length % 4)) % 4;
    if (padding) fs.writeSync(fd, Buffer.alloc(padding), 0, padding, 16 + jsonBuffer.length);
    let offset = baseOffset;
    for (const meta of metas) {
      const buffer = fs.readFileSync(meta.full);
      fs.writeSync(fd, buffer, 0, buffer.length, offset);
      offset += buffer.length;
    }
    return {
      fileCount: metas.length,
      dirCount: dirs.length,
      headerBytes: baseOffset,
      archiveBytes: offset,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function listingFromAsar(archivePath) {
  const { header } = readAsarHeader(archivePath);
  const { files, dirs } = flattenAsarHeader(header);
  const listing = new Map();
  for (const file of files) {
    listing.set(file.path, `${file.size}:${file.hash || ""}`);
  }
  return { files: listing, dirs: dirs.sort() };
}

function listingFromDir(rootDir) {
  const { files, dirs } = collectFiles(rootDir);
  const listing = new Map();
  for (const file of files) {
    listing.set(file.path, `${file.size}:${sha256File(file.full)}`);
  }
  return { files: listing, dirs: dirs.sort() };
}

function compareListings(expected, actual) {
  const expectedPaths = [...expected.files.keys()].sort();
  const actualPaths = [...actual.files.keys()].sort();
  const missing = expectedPaths.filter((item) => !actual.files.has(item));
  const extra = actualPaths.filter((item) => !expected.files.has(item));
  const changed = expectedPaths.filter(
    (item) => actual.files.has(item) && expected.files.get(item) !== actual.files.get(item),
  );
  const dirsMissing = expected.dirs.filter((item) => !actual.dirs.includes(item));
  const dirsExtra = actual.dirs.filter((item) => !expected.dirs.includes(item));
  return {
    ok:
      missing.length === 0 &&
      extra.length === 0 &&
      changed.length === 0 &&
      dirsMissing.length === 0 &&
      dirsExtra.length === 0,
    expectedFileCount: expectedPaths.length,
    actualFileCount: actualPaths.length,
    expectedDirCount: expected.dirs.length,
    actualDirCount: actual.dirs.length,
    missing,
    extra,
    changed,
    dirsMissing,
    dirsExtra,
  };
}

module.exports = {
  BLOCK_SIZE,
  compareListings,
  listingFromAsar,
  listingFromDir,
  packAsar,
  readAsarHeader,
  sha256File,
  unpackAsar,
};

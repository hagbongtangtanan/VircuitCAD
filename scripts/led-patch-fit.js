"use strict";

function parseLedPins(source) {
  const start = source.indexOf("var ledDefinition = {");
  if (start === -1) throw new Error("ledDefinition not found");
  const end = source.indexOf("\n};", start);
  if (end === -1) throw new Error("ledDefinition end not found");
  const block = source.slice(start, end);
  const anode = block.match(
    /pin\("anode"[\s\S]*?\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+),?\s*\}/,
  );
  const cathode = block.match(
    /pin\("cathode"[\s\S]*?\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+),?\s*\}/,
  );
  if (!anode || !cathode) throw new Error("LED pin coordinates not found");
  return {
    anode: { x: Number(anode[1]), y: Number(anode[2]) },
    cathode: { x: Number(cathode[1]), y: Number(cathode[2]) },
  };
}

function parseDesignAnchors(moduleSource) {
  const anodeX = moduleSource.match(/const ANCHOR_A_X = (-?[\d.]+);/) || moduleSource.match(/ANCHOR_A_X:\s*(-?[\d.]+)/) || moduleSource.match(/"ANCHOR_A_X":\s*(-?[\d.]+)/);
  const cathodeX = moduleSource.match(/const ANCHOR_K_X = (-?[\d.]+);/) || moduleSource.match(/ANCHOR_K_X:\s*(-?[\d.]+)/) || moduleSource.match(/"ANCHOR_K_X":\s*(-?[\d.]+)/);
  const anchorY = moduleSource.match(/const ANCHOR_Y = (-?[\d.]+);/) || moduleSource.match(/ANCHOR_Y:\s*(-?[\d.]+)/) || moduleSource.match(/"ANCHOR_Y":\s*(-?[\d.]+)/);
  if (!anodeX || !cathodeX || !anchorY) throw new Error("design anchors not found");
  return {
    anodeX: Number(anodeX[1]),
    cathodeX: Number(cathodeX[1]),
    anchorY: Number(anchorY[1]),
  };
}

function computeFit(source, moduleSource) {
  const pins = parseLedPins(source);
  const anchors = parseDesignAnchors(moduleSource);
  const existingSpacing = pins.cathode.x - pins.anode.x;
  const designSpacing = anchors.cathodeX - anchors.anodeX;
  if (!existingSpacing || !designSpacing) throw new Error("invalid anchor spacing");
  const scale = existingSpacing / designSpacing;
  return {
    scale,
    originX: pins.anode.x - scale * anchors.anodeX,
    originY: pins.anode.y - scale * anchors.anchorY,
    anodePartLocal: pins.anode,
    cathodePartLocal: pins.cathode,
    existingSpacing,
    designSpacing,
  };
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(12)));
}

module.exports = { computeFit, formatNumber, parseDesignAnchors, parseLedPins };

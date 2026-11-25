import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const base = new URL("../", import.meta.url).pathname;
global.window = {};
vm.runInThisContext(
  fs.readFileSync(
    new URL("../recovered-src/out/renderer/assets/damage-ratings.js", import.meta.url),
    "utf8",
  ),
  { filename: "damage-ratings.js" },
);
vm.runInThisContext(
  fs.readFileSync(
    new URL("../recovered-src/out/renderer/assets/damage-core.js", import.meta.url),
    "utf8",
  ),
  { filename: "damage-core.js" },
);

const engine = global.window.__LCD_DAMAGE_ENGINE__;
assert.ok(engine, "damage engine loaded");
engine.setSettings({ damageTimeScale: "demo", effects: true });

const netlist = () => ({
  netIdOf: ({ partId, pinId }) => `${partId}:${pinId}`,
});
const voltages = (entries) => new Map(Object.entries(entries));
const run = (scenario) => {
  engine.reset();
  let result;
  for (let index = 0; index < (scenario.steps ?? 1); index += 1) {
    result = engine.step({
      document: scenario.document,
      solve: scenario.solve ?? {},
      netlist: netlist(),
      drivers: scenario.drivers ?? new Map(),
      inputs: scenario.inputs,
      deltaSeconds: scenario.dt ?? 0.01,
      simMs: index * (scenario.dt ?? 0.01) * 1000,
    });
  }
  return { result, snapshot: engine.snapshot() };
};
const state = (snapshot, key) =>
  snapshot.states.find((entry) => entry.key === key);
const hasEvent = (snapshot, text) =>
  snapshot.events.some((event) => event.message.includes(text));

{
  const { result, snapshot } = run({
    document: { parts: [{ id: "led1", type: "led", props: { color: "red" } }], wires: [] },
    solve: {
      ledCurrents: new Map([["led1", 0.0136]]),
      netVoltages: voltages({ "led1:anode": 5, "led1:cathode": 2 }),
    },
    steps: 1000,
  });
  assert.equal(result.changedTopology, false);
  assert.equal(snapshot.failedParts.length, 0);
  assert.equal(state(snapshot, "part:led1").status, "ok");
  assert.ok(state(snapshot, "part:led1").stress < 1);
  assert.ok(state(snapshot, "part:led1").heatC < 60);
}

{
  const { result, snapshot } = run({
    document: { parts: [{ id: "led2", type: "led", props: { color: "red" } }], wires: [] },
    solve: {
      ledCurrents: new Map([["led2", 0.5]]),
      netVoltages: voltages({ "led2:anode": 5, "led2:cathode": 0 }),
    },
  });
  assert.equal(result.changedTopology, true);
  assert.deepEqual(snapshot.failedParts, ["led2"]);
  assert.ok(hasEvent(snapshot, "LED led2 burnt"));
}

{
  const { snapshot } = run({
    document: {
      parts: [{ id: "r1", type: "resistor", props: { resistanceOhms: 100 } }],
      wires: [],
    },
    solve: { netVoltages: voltages({ "r1:lead1": 12, "r1:lead2": 0 }) },
    steps: 400,
  });
  assert.deepEqual(snapshot.failedParts, ["r1"]);
  assert.ok(hasEvent(snapshot, "R r1 burnt"));
}

{
  const { snapshot } = run({
    document: {
      parts: [{ id: "uno1", type: "arduino-uno", props: { inputVoltage: 5 } }],
      wires: [],
    },
    solve: {
      sourceCurrents: new Map([["uno1:D9", 0.13]]),
      netVoltages: voltages({ "uno1:D9": 5, "uno1:GND": 0 }),
    },
    drivers: new Map([["uno1:D9", { volts: 5 }]]),
  });
  assert.ok(snapshot.failedParts.includes("uno1"));
  assert.ok(snapshot.deadPins.includes("uno1:D9"));
}

{
  const { snapshot } = run({
    document: {
      parts: [{ id: "seg1", type: "seven-segment", props: { color: "red" } }],
      wires: [],
    },
    solve: {
      ledCurrents: new Map([["seg1:a", 0.1]]),
      netVoltages: voltages({ "seg1:common": 0, "seg1:a": 2 }),
    },
  });
  assert.ok(snapshot.failedSegments.includes("seg1:a"));
  assert.ok(!snapshot.failedSegments.includes("seg1:b"));
  assert.ok(snapshot.failedParts.includes("seg1"));
}

{
  const drivers = new Map([["uno2:5V", { volts: 5 }]]);
  const { result, snapshot } = run({
    document: {
      parts: [{ id: "uno2", type: "arduino-uno", props: { inputVoltage: 5 } }],
      wires: [
        {
          id: "w1",
          from: { partId: "uno2", pinId: "5V" },
          to: { partId: "uno2", pinId: "GND" },
        },
      ],
    },
    solve: {
      sourceCurrents: new Map([["uno2:5V", 2.0]]),
      netVoltages: voltages({ "uno2:5V": 0.1, "uno2:GND": 0 }),
    },
    drivers,
  });
  assert.equal(result.changedTopology, true);
  assert.ok(hasEvent(snapshot, "USB overcurrent protection tripped"));
  const protection = engine.applyProtection(drivers, 10);
  assert.equal(protection.tripped, true);
  assert.equal(drivers.has("uno2:5V"), false);
}

{
  const { snapshot } = run({
    document: { parts: [{ id: "led3", type: "led", props: { color: "blue" } }], wires: [] },
    solve: {
      ledCurrents: new Map(),
      netVoltages: voltages({ "led3:anode": 0, "led3:cathode": 6 }),
    },
  });
  assert.ok(hasEvent(snapshot, "Vreverse = -6.0 V"));
}

{
  const { snapshot } = run({
    document: {
      parts: [{ id: "uno3", type: "arduino-uno", props: { inputVoltage: 18 } }],
      wires: [],
    },
    solve: {
      sourceCurrents: new Map([["uno3:VIN", 0.1]]),
      netVoltages: voltages({ "uno3:VIN": 18, "uno3:GND": 0 }),
    },
    steps: 800,
  });
  assert.ok(snapshot.failedParts.includes("uno3"));
  assert.ok(hasEvent(snapshot, "Arduino uno3 burnt"));
}

{
  const { snapshot } = run({
    document: {
      parts: [{ id: "lcd1", type: "lcd-16x2-i2c", props: {} }],
      wires: [],
    },
    solve: {
      ledCurrents: new Map([["lcd1:backlight", 0.02]]),
      netVoltages: voltages({ "lcd1:vcc": 12, "lcd1:gnd": 0 }),
    },
  });
  assert.ok(snapshot.failedParts.includes("lcd1"));
  assert.ok(hasEvent(snapshot, "Vcc = 12.0 V > 6 V"));
}

{
  const { snapshot } = run({
    document: {
      parts: [
        {
          id: "c1",
          type: "electrolytic-capacitor",
          props: { voltageRatingV: 16, electrolytic: true },
        },
      ],
      wires: [],
    },
    solve: { netVoltages: voltages({ "c1:1": 0, "c1:2": 9 }) },
  });
  assert.ok(snapshot.failedParts.includes("c1"));
  assert.ok(hasEvent(snapshot, "Vreverse = -9.0 V"));
}

{
  const { result, snapshot } = run({
    document: {
      parts: [{ id: "btn_open", type: "push-button", props: {} }],
      wires: [],
    },
    solve: {
      netVoltages: voltages({ "btn_open:1A": 5, "btn_open:2A": 0 }),
    },
    steps: 400,
  });
  assert.equal(result.changedTopology, false);
  assert.equal(snapshot.failedParts.length, 0);
  assert.equal(state(snapshot, "part:btn_open").status, "ok");
}

{
  const { snapshot } = run({
    document: {
      parts: [{ id: "btn_pressed", type: "push-button", props: {} }],
      wires: [],
    },
    solve: {
      netVoltages: voltages({ "btn_pressed:1A": 5, "btn_pressed:2A": 0 }),
    },
    inputs: { pressedParts: new Set(["btn_pressed"]) },
    steps: 20,
  });
  assert.ok(snapshot.failedParts.includes("btn_pressed"));
  assert.ok(hasEvent(snapshot, "Button btn_pressed burnt"));
}

{
  const snapshot = engine.snapshot();
  assert.ok(snapshot.events.length > 0);
  engine.repairAll();
  const repaired = engine.snapshot();
  assert.equal(repaired.failedParts.length, 0);
  assert.equal(repaired.failedSegments.length, 0);
  assert.equal(repaired.deadPins.length, 0);
  assert.equal(repaired.failedWires.length, 0);
}

console.log("damage-scenarios: 12 scenarios passed");

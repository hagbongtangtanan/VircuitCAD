let electron = require("electron");
let node_path = require("node:path");
let node_fs = require("node:fs");
let zod = require("zod");
let node_child_process = require("node:child_process");
let node_fs_promises = require("node:fs/promises");
let node_os = require("node:os");
//#region src/shared/app.ts
/**
 * Product identity. Every user-visible mention of the application name comes
 * from here so a rename is a single-line change; `package.json` metadata is the
 * only other place the name appears.
 */
var APP_NAME = "VircuitCAD";
//#endregion
//#region src/shared/ipc.ts
/**
 * Every IPC channel the renderer may reach, in one place. Main and preload both
 * import from here so a channel name can never drift between the two sides.
 */
var IpcChannels = {
  ping: "app:ping",
  compile: "build:compile",
  toolchainStatus: "build:toolchain-status",
  openFile: "file:open",
  takeLaunchFile: "file:take-launch",
  fileOpened: "file:opened",
  fileOpenError: "file:open-error",
  saveProject: "file:save-project",
  exportSketch: "file:export-sketch",
  exportHex: "file:export-hex",
  exportPng: "file:export-png",
  exportPdf: "file:export-pdf",
  listSamples: "file:list-samples",
  openSample: "file:open-sample",
};
zod.z.enum([
  "arduino-uno",
  "raspberry-pi",
  "breadboard",
  "led",
  "resistor",
  "push-button",
  "potentiometer",
  "buzzer",
  "capacitor",
  "diode",
  "inductor",
  "slide-switch",
  "ldr",
  "rgb-led",
  "seven-segment",
  "dc-motor",
  "battery-aa",
  "battery-9v",
  "power-supply",
  "electrolytic-capacitor",
  "zener-diode",
  "light-bulb",
  "vibration-motor",
  "gear-motor",
  "thermistor",
  "flex-sensor",
  "force-sensor",
  "photodiode",
  "phototransistor",
  "tilt-sensor",
  "soil-moisture",
  "gas-sensor",
  "tmp36",
  "coin-cell",
  "solar-cell",
  "potato-battery",
  "dip-switch-4",
  "dip-switch-6",
  "lm7805",
  "ld1117v33",
  "ir-receiver",
  "ultrasonic-3pin",
  "ultrasonic-hcsr04",
  "pir-sensor",
  "keypad-4x4",
  "neopixel-strip",
  "neopixel-ring",
  "ir-remote",
  "encoder-motor",
  "servo",
  "lcd-16x2",
  "lcd-16x2-i2c",
  "seven-segment-clock",
  "microbit",
  "attiny85",
  "multimeter",
  "function-generator",
  "oscilloscope",
  "ic-555",
  "ic-556",
  "opamp-741",
  "comparator-lm393",
  "comparator-lm339",
  "optocoupler-4n35",
  "transistor-npn",
  "transistor-pnp",
  "tip120",
  "mosfet-n",
  "mosfet-p",
  "relay-spdt",
  "relay-dpdt",
  "l293d",
  "header-8",
  "usb-a",
  "breadboard-small",
  "breadboard-mini",
  "74hc00",
  "74hc02",
  "74hc08",
  "74hc32",
  "74hc86",
  "74hc04",
  "74hc14",
  "74hc131",
  "74hc132",
  "74hc10",
  "74hc11",
  "74hc27",
  "74hc20",
  "74hc21",
  "74hc73",
  "74hc74",
  "74hc75",
  "74hc93",
  "74hc283",
  "74hc595",
  "74hc4017",
  "cd4511",
]);
var pointSchema = zod.z.strictObject({
  x: zod.z.number(),
  y: zod.z.number(),
});
var rotationSchema = zod.z.union([
  zod.z.literal(0),
  zod.z.literal(90),
  zod.z.literal(180),
  zod.z.literal(270),
]);
var ledColorSchema = zod.z.enum(["red", "green", "blue", "yellow", "white"]);
/** Per-part property shapes. Empty objects still parse strictly, so unknown keys fail. */
var partPropsSchemas = {
  "arduino-uno": zod.z.strictObject({}),
  "raspberry-pi": zod.z.strictObject({}),
  breadboard: zod.z.strictObject({}),
  led: zod.z.strictObject({ color: ledColorSchema }),
  resistor: zod.z.strictObject({
    resistanceOhms: zod.z.number().positive().max(1e6),
  }),
  "push-button": zod.z.strictObject({}),
  potentiometer: zod.z.strictObject({
    resistanceOhms: zod.z.number().positive().max(1e6),
  }),
  buzzer: zod.z.strictObject({}),
  capacitor: zod.z.strictObject({
    capacitanceMicroFarads: zod.z.number().positive().max(1e6),
  }),
  diode: zod.z.strictObject({}),
  inductor: zod.z.strictObject({
    inductanceMilliHenries: zod.z.number().positive().max(1e6),
  }),
  "slide-switch": zod.z.strictObject({}),
  ldr: zod.z.strictObject({}),
  "rgb-led": zod.z.strictObject({}),
  "seven-segment": zod.z.strictObject({ color: ledColorSchema }),
  "dc-motor": zod.z.strictObject({}),
  "battery-aa": zod.z.strictObject({}),
  "battery-9v": zod.z.strictObject({}),
  "power-supply": zod.z.strictObject({}),
  "electrolytic-capacitor": zod.z.strictObject({
    capacitanceMicroFarads: zod.z.number().positive().max(1e6),
  }),
  "zener-diode": zod.z.strictObject({
    zenerVoltage: zod.z.number().min(2).max(30),
  }),
  "light-bulb": zod.z.strictObject({
    ratedVolts: zod.z.number().positive().max(24),
    resistanceOhms: zod.z.number().positive().max(1e5),
  }),
  "vibration-motor": zod.z.strictObject({}),
  "gear-motor": zod.z.strictObject({}),
  thermistor: zod.z.strictObject({}),
  "flex-sensor": zod.z.strictObject({}),
  "force-sensor": zod.z.strictObject({}),
  photodiode: zod.z.strictObject({}),
  phototransistor: zod.z.strictObject({}),
  "tilt-sensor": zod.z.strictObject({}),
  "soil-moisture": zod.z.strictObject({}),
  "gas-sensor": zod.z.strictObject({}),
  tmp36: zod.z.strictObject({}),
  "coin-cell": zod.z.strictObject({}),
  "solar-cell": zod.z.strictObject({}),
  "potato-battery": zod.z.strictObject({}),
  "dip-switch-4": zod.z.strictObject({}),
  "dip-switch-6": zod.z.strictObject({}),
  lm7805: zod.z.strictObject({}),
  ld1117v33: zod.z.strictObject({}),
  "ir-receiver": zod.z.strictObject({}),
  "ultrasonic-3pin": zod.z.strictObject({}),
  "ultrasonic-hcsr04": zod.z.strictObject({}),
  "pir-sensor": zod.z.strictObject({}),
  "keypad-4x4": zod.z.strictObject({}),
  "neopixel-strip": zod.z.strictObject({
    pixelCount: zod.z.number().int().min(4).max(24),
    color: ledColorSchema,
  }),
  "neopixel-ring": zod.z.strictObject({
    pixelCount: zod.z.number().int().min(12).max(24),
    color: ledColorSchema,
  }),
  "ir-remote": zod.z.strictObject({}),
  "encoder-motor": zod.z.strictObject({}),
  servo: zod.z.strictObject({}),
  "lcd-16x2": zod.z.strictObject({}),
  "lcd-16x2-i2c": zod.z.strictObject({}),
  "seven-segment-clock": zod.z.strictObject({}),
  microbit: zod.z.strictObject({}),
  attiny85: zod.z.strictObject({}),
  multimeter: zod.z.strictObject({
    mode: zod.z.enum(["volts", "amps", "ohms"]),
  }),
  "function-generator": zod.z.strictObject({
    waveform: zod.z.enum(["sine", "square", "triangle"]),
    frequencyHz: zod.z.number().positive().max(1e5),
    amplitudeVolts: zod.z.number().min(0).max(12),
    offsetVolts: zod.z.number().min(-12).max(12),
  }),
  oscilloscope: zod.z.strictObject({}),
  "ic-555": zod.z.strictObject({}),
  "ic-556": zod.z.strictObject({}),
  "opamp-741": zod.z.strictObject({}),
  "comparator-lm393": zod.z.strictObject({}),
  "comparator-lm339": zod.z.strictObject({}),
  "optocoupler-4n35": zod.z.strictObject({}),
  "transistor-npn": zod.z.strictObject({}),
  "transistor-pnp": zod.z.strictObject({}),
  tip120: zod.z.strictObject({}),
  "mosfet-n": zod.z.strictObject({}),
  "mosfet-p": zod.z.strictObject({}),
  "relay-spdt": zod.z.strictObject({}),
  "relay-dpdt": zod.z.strictObject({}),
  l293d: zod.z.strictObject({}),
  "header-8": zod.z.strictObject({}),
  "usb-a": zod.z.strictObject({}),
  "breadboard-small": zod.z.strictObject({}),
  "breadboard-mini": zod.z.strictObject({}),
  "74hc00": zod.z.strictObject({}),
  "74hc02": zod.z.strictObject({}),
  "74hc08": zod.z.strictObject({}),
  "74hc32": zod.z.strictObject({}),
  "74hc86": zod.z.strictObject({}),
  "74hc04": zod.z.strictObject({}),
  "74hc14": zod.z.strictObject({}),
  "74hc131": zod.z.strictObject({}),
  "74hc132": zod.z.strictObject({}),
  "74hc10": zod.z.strictObject({}),
  "74hc11": zod.z.strictObject({}),
  "74hc27": zod.z.strictObject({}),
  "74hc20": zod.z.strictObject({}),
  "74hc21": zod.z.strictObject({}),
  "74hc73": zod.z.strictObject({}),
  "74hc74": zod.z.strictObject({}),
  "74hc75": zod.z.strictObject({}),
  "74hc93": zod.z.strictObject({}),
  "74hc283": zod.z.strictObject({}),
  "74hc595": zod.z.strictObject({}),
  "74hc4017": zod.z.strictObject({}),
  cd4511: zod.z.strictObject({}),
};
var pinRefSchema = zod.z.strictObject({
  partId: zod.z.string().min(1),
  pinId: zod.z.string().min(1),
});
var wireSchema = zod.z.strictObject({
  id: zod.z.string().min(1),
  from: pinRefSchema,
  to: pinRefSchema,
  color: zod.z.string().regex(/^#[0-9a-fA-F]{6}$/),
  waypoints: zod.z.array(pointSchema),
});
function partVariant(type) {
  return {
    id: zod.z.string().min(1),
    type: zod.z.literal(type),
    position: pointSchema,
    rotation: rotationSchema,
    flipX: zod.z.boolean().optional(),
    flipY: zod.z.boolean().optional(),
    props: partPropsSchemas[type],
  };
}
var partSchema = zod.z.discriminatedUnion("type", [
  zod.z.strictObject(partVariant("arduino-uno")),
  zod.z.strictObject(partVariant("raspberry-pi")),
  zod.z.strictObject(partVariant("breadboard")),
  zod.z.strictObject(partVariant("led")),
  zod.z.strictObject(partVariant("resistor")),
  zod.z.strictObject(partVariant("push-button")),
  zod.z.strictObject(partVariant("potentiometer")),
  zod.z.strictObject(partVariant("buzzer")),
  zod.z.strictObject(partVariant("capacitor")),
  zod.z.strictObject(partVariant("diode")),
  zod.z.strictObject(partVariant("inductor")),
  zod.z.strictObject(partVariant("slide-switch")),
  zod.z.strictObject(partVariant("ldr")),
  zod.z.strictObject(partVariant("rgb-led")),
  zod.z.strictObject(partVariant("seven-segment")),
  zod.z.strictObject(partVariant("dc-motor")),
  zod.z.strictObject(partVariant("battery-aa")),
  zod.z.strictObject(partVariant("battery-9v")),
  zod.z.strictObject(partVariant("power-supply")),
  zod.z.strictObject(partVariant("electrolytic-capacitor")),
  zod.z.strictObject(partVariant("zener-diode")),
  zod.z.strictObject(partVariant("light-bulb")),
  zod.z.strictObject(partVariant("vibration-motor")),
  zod.z.strictObject(partVariant("gear-motor")),
  zod.z.strictObject(partVariant("thermistor")),
  zod.z.strictObject(partVariant("flex-sensor")),
  zod.z.strictObject(partVariant("force-sensor")),
  zod.z.strictObject(partVariant("photodiode")),
  zod.z.strictObject(partVariant("phototransistor")),
  zod.z.strictObject(partVariant("tilt-sensor")),
  zod.z.strictObject(partVariant("soil-moisture")),
  zod.z.strictObject(partVariant("gas-sensor")),
  zod.z.strictObject(partVariant("tmp36")),
  zod.z.strictObject(partVariant("coin-cell")),
  zod.z.strictObject(partVariant("solar-cell")),
  zod.z.strictObject(partVariant("potato-battery")),
  zod.z.strictObject(partVariant("dip-switch-4")),
  zod.z.strictObject(partVariant("dip-switch-6")),
  zod.z.strictObject(partVariant("lm7805")),
  zod.z.strictObject(partVariant("ld1117v33")),
  zod.z.strictObject(partVariant("ir-receiver")),
  zod.z.strictObject(partVariant("ultrasonic-3pin")),
  zod.z.strictObject(partVariant("ultrasonic-hcsr04")),
  zod.z.strictObject(partVariant("pir-sensor")),
  zod.z.strictObject(partVariant("keypad-4x4")),
  zod.z.strictObject(partVariant("neopixel-strip")),
  zod.z.strictObject(partVariant("neopixel-ring")),
  zod.z.strictObject(partVariant("ir-remote")),
  zod.z.strictObject(partVariant("encoder-motor")),
  zod.z.strictObject(partVariant("servo")),
  zod.z.strictObject(partVariant("lcd-16x2")),
  zod.z.strictObject(partVariant("lcd-16x2-i2c")),
  zod.z.strictObject(partVariant("seven-segment-clock")),
  zod.z.strictObject(partVariant("microbit")),
  zod.z.strictObject(partVariant("attiny85")),
  zod.z.strictObject(partVariant("multimeter")),
  zod.z.strictObject(partVariant("function-generator")),
  zod.z.strictObject(partVariant("oscilloscope")),
  zod.z.strictObject(partVariant("ic-555")),
  zod.z.strictObject(partVariant("ic-556")),
  zod.z.strictObject(partVariant("opamp-741")),
  zod.z.strictObject(partVariant("comparator-lm393")),
  zod.z.strictObject(partVariant("comparator-lm339")),
  zod.z.strictObject(partVariant("optocoupler-4n35")),
  zod.z.strictObject(partVariant("transistor-npn")),
  zod.z.strictObject(partVariant("transistor-pnp")),
  zod.z.strictObject(partVariant("tip120")),
  zod.z.strictObject(partVariant("mosfet-n")),
  zod.z.strictObject(partVariant("mosfet-p")),
  zod.z.strictObject(partVariant("relay-spdt")),
  zod.z.strictObject(partVariant("relay-dpdt")),
  zod.z.strictObject(partVariant("l293d")),
  zod.z.strictObject(partVariant("header-8")),
  zod.z.strictObject(partVariant("usb-a")),
  zod.z.strictObject(partVariant("breadboard-small")),
  zod.z.strictObject(partVariant("breadboard-mini")),
  zod.z.strictObject(partVariant("74hc00")),
  zod.z.strictObject(partVariant("74hc02")),
  zod.z.strictObject(partVariant("74hc08")),
  zod.z.strictObject(partVariant("74hc32")),
  zod.z.strictObject(partVariant("74hc86")),
  zod.z.strictObject(partVariant("74hc04")),
  zod.z.strictObject(partVariant("74hc14")),
  zod.z.strictObject(partVariant("74hc131")),
  zod.z.strictObject(partVariant("74hc132")),
  zod.z.strictObject(partVariant("74hc10")),
  zod.z.strictObject(partVariant("74hc11")),
  zod.z.strictObject(partVariant("74hc27")),
  zod.z.strictObject(partVariant("74hc20")),
  zod.z.strictObject(partVariant("74hc21")),
  zod.z.strictObject(partVariant("74hc73")),
  zod.z.strictObject(partVariant("74hc74")),
  zod.z.strictObject(partVariant("74hc75")),
  zod.z.strictObject(partVariant("74hc93")),
  zod.z.strictObject(partVariant("74hc283")),
  zod.z.strictObject(partVariant("74hc595")),
  zod.z.strictObject(partVariant("74hc4017")),
  zod.z.strictObject(partVariant("cd4511")),
]);
var noteSchema = zod.z.strictObject({
  id: zod.z.string().min(1),
  text: zod.z.string().max(4e3),
  position: pointSchema,
});
var circuitDocumentSchema = zod.z.strictObject({
  version: zod.z.literal(1),
  parts: zod.z.array(partSchema),
  wires: zod.z.array(wireSchema),
  /** Canvas annotations; omitted in projects saved before notes existed. */
  notes: zod.z.array(noteSchema).optional(),
});
//#endregion
//#region src/shared/schemas.ts
/**
 * Runtime versions reported by the Electron main process. Used by the renderer
 * shell as a smoke test that the IPC boundary is wired correctly.
 */
var runtimeVersionsSchema = zod.z.strictObject({
  electron: zod.z.string().min(1),
  chrome: zod.z.string().min(1),
  node: zod.z.string().min(1),
});
var pingRequestSchema = zod.z.strictObject({
  sentAt: zod.z.number().int().nonnegative(),
});
zod.z.strictObject({
  /** Milliseconds since the epoch, measured in the main process. */
  receivedAt: zod.z.number().int().nonnegative(),
  /** Echo of `PingRequest.sentAt`, proving the payload survived the round trip. */
  echo: zod.z.number().int().nonnegative(),
  versions: runtimeVersionsSchema,
});
/** Largest sketch we accept, so a runaway paste cannot stall the compiler. */
var MAX_SKETCH_LENGTH = 2e5;
var compileRequestSchema = zod.z.strictObject({
  /** Arduino C++ source, as typed in the editor. */
  sketch: zod.z.string().max(MAX_SKETCH_LENGTH),
});
var diagnosticSeveritySchema = zod.z.enum(["error", "warning", "note"]);
var diagnosticSchema = zod.z.strictObject({
  severity: diagnosticSeveritySchema,
  /** 1-based, mapped back onto the sketch the user wrote. */
  line: zod.z.number().int().positive().nullable(),
  column: zod.z.number().int().positive().nullable(),
  message: zod.z.string(),
});
/** Flash/RAM usage reported by `avr-size`, in bytes. */
var memoryUsageSchema = zod.z.strictObject({
  flashBytes: zod.z.number().int().nonnegative(),
  flashCapacity: zod.z.number().int().positive(),
  ramBytes: zod.z.number().int().nonnegative(),
  ramCapacity: zod.z.number().int().positive(),
});
zod.z.strictObject({
  ok: zod.z.boolean(),
  /** Intel HEX, present only when the sketch linked. */
  hex: zod.z.string().nullable(),
  diagnostics: zod.z.array(diagnosticSchema),
  memory: memoryUsageSchema.nullable(),
  durationMs: zod.z.number().int().nonnegative(),
});
zod.z.strictObject({
  available: zod.z.boolean(),
  /** e.g. `avr-g++ (GCC) 14.3.0`, or the reason the toolchain is unusable. */
  detail: zod.z.string(),
  avrGcc: zod.z.string().nullable(),
  arduinoCore: zod.z.string().nullable(),
});
//#endregion
//#region src/shared/project.ts
/**
 * The on-disk project format. A project is a circuit plus the sketch it runs;
 * keeping both in one file means "open" always restores a runnable state.
 *
 * Version 2 adds a strict metadata header and the canvas viewport. Version 1
 * files written before those fields existed remain readable and are upgraded
 * the next time they are saved.
 */
var PROJECT_FORMAT = "vircuit-project";
var LEGACY_PROJECT_EXTENSION = "vircuit";
var projectMetadataSchema = zod.z.strictObject({
  created_at: zod.z.string().min(1).max(64),
  app_version: zod.z.string().min(1).max(64),
});
var projectViewportSchema = zod.z.strictObject({
  scale: zod.z.number().positive(),
  offsetX: zod.z.number(),
  offsetY: zod.z.number(),
});
var currentProjectFileSchema = zod.z.strictObject({
  format: zod.z.literal(PROJECT_FORMAT),
  version: zod.z.literal(2),
  metadata: projectMetadataSchema,
  viewport: projectViewportSchema,
  /** Optional for projects written before titles were persisted. */
  name: zod.z.string().trim().min(1).max(120).optional(),
  circuit: circuitDocumentSchema,
  sketch: zod.z.string().max(MAX_SKETCH_LENGTH),
});
var legacyProjectFileSchema = zod.z.strictObject({
  format: zod.z.literal(PROJECT_FORMAT),
  version: zod.z.literal(1),
  name: zod.z.string().trim().min(1).max(120).optional(),
  circuit: circuitDocumentSchema,
  sketch: zod.z.string().max(MAX_SKETCH_LENGTH),
});
var projectFileSchema = zod.z.union([
  currentProjectFileSchema,
  legacyProjectFileSchema,
]);
function serializeProject(project) {
  return `${JSON.stringify(project, null, 2)}\n`;
}
var ProjectFileError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectFileError";
  }
};
function parseProjectText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProjectFileError("The file is not valid JSON.");
  }
  const current = currentProjectFileSchema.safeParse(parsed);
  if (current.success) return current.data;
  const legacy = legacyProjectFileSchema.safeParse(parsed);
  if (legacy.success) return legacy.data;
  const [issue] =
    current.error.issues.length > 0
      ? current.error.issues
      : legacy.error.issues;
  throw new ProjectFileError(
    `This is not a VircuitCAD project: ${issue?.path.join(".") ?? "document"} — ${issue?.message ?? "invalid data"}`,
  );
}
function fileExtension(path) {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}
/** Chooses how an opened file is interpreted from its extension. */
function openKindForPath(path) {
  const extension = fileExtension(path);
  if (extension === "vcc" || extension === "vircuit" || extension === "json")
    return "project";
  if (extension === "ino") return "sketch";
  return null;
}
function parseSketchText(text) {
  if (text.length > 2e5)
    throw new ProjectFileError(
      `The sketch is larger than ${MAX_SKETCH_LENGTH} characters.`,
    );
  return text;
}
/** Adds the expected extension unless the user already typed one. */
function withExtension(path, extension) {
  return fileExtension(path) === extension ? path : `${path}.${extension}`;
}
var saveProjectRequestSchema = zod.z.strictObject({
  project: projectFileSchema,
  /** Where to write; null asks the user through a save dialog. */
  path: zod.z.string().min(1).nullable(),
});
var exportSketchRequestSchema = zod.z.strictObject({
  sketch: zod.z.string().max(MAX_SKETCH_LENGTH),
  path: zod.z.string().min(1).nullable(),
});
var exportHexRequestSchema = zod.z.strictObject({
  hex: zod.z.string().min(1).max(4e5),
  path: zod.z.string().min(1).nullable(),
});
zod.z.strictObject({ path: zod.z.string().min(1) });
var PNG_DATA_URL_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
var PDF_BASE64_PATTERN = /^[A-Za-z0-9+/=]+$/;
var exportPngRequestSchema = zod.z.strictObject({
  dataUrl: zod.z.string().min(32).max(32e6).regex(PNG_DATA_URL_PATTERN),
  /** Base name used for the save dialog; the main process strips path characters. */
  name: zod.z.string().min(1).max(120),
  path: zod.z.string().min(1).nullable(),
});
var exportPdfRequestSchema = zod.z.strictObject({
  data: zod.z.string().min(32).max(48e6).regex(PDF_BASE64_PATTERN),
  /** Base name used for the save dialog; the main process strips path characters. */
  name: zod.z.string().min(1).max(120),
  path: zod.z.string().min(1).nullable(),
});
/** Shipped examples; the name doubles as the file name and is never a path. */
var SAMPLE_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:vcc|vircuit)$/;
var openSampleRequestSchema = zod.z.strictObject({
  name: zod.z.string().regex(SAMPLE_NAME_PATTERN),
});
function sampleLabel(name) {
  const base = name.replace(/\.(?:vcc|vircuit)$/, "").replace(/-/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}
//#endregion
//#region src/shared/compile.ts
/**
 * Pure helpers behind the compiler: nothing here touches the file system, so the
 * tricky parts (Arduino's automatic prototypes, GCC's diagnostic format) are unit
 * tested directly.
 */
var CONTROL_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "for",
  "while",
  "switch",
  "do",
  "else",
  "return",
  "catch",
  "case",
  "sizeof",
  "throw",
]);
/** Declaration keywords that never introduce a forward-declarable function. */
var NON_FUNCTION_KEYWORDS =
  /\btemplate\b|\bclass\b|\bstruct\b|\benum\b|\bnamespace\b|\bunion\b/;
/**
 * Blanks out comments, string and character literals while preserving every
 * offset and line break, so indices found here stay valid in the original text.
 */
function blankLiterals(source) {
  const out = Array.from(source, (character) =>
    character === "\n" ? "\n" : " ",
  );
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? "";
    const next = source[index + 1] ?? "";
    if (character === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      ) {
        if (source[index] === "\n") out[index] = "\n";
        index += 1;
      }
      index += 2;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\") index += 1;
        index += 1;
      }
      index += 1;
      continue;
    }
    out[index] = character;
    index += 1;
  }
  return out.join("");
}
/** Skips backwards over whitespace, returning the index of the last real character. */
function skipSpaceBackwards(text, from) {
  let index = from;
  while (index >= 0 && /\s/.test(text[index] ?? "")) index -= 1;
  return index;
}
/** Index of the `(` matching the `)` at `closeIndex`, or -1. */
function matchOpenParen(text, closeIndex) {
  let depth = 0;
  for (let index = closeIndex; index >= 0; index -= 1) {
    const character = text[index];
    if (character === ")") depth += 1;
    else if (character === "(") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}
/** Start index of the identifier ending at `endIndex` (inclusive), or -1. */
function identifierStart(text, endIndex) {
  let index = endIndex;
  while (index >= 0 && /[A-Za-z0-9_~]/.test(text[index] ?? "")) index -= 1;
  return index + 1;
}
/**
 * Drops complete preprocessor lines from a declaration prefix. `#include` and
 * friends do not end with a semicolon, so the backwards scan happily walks past
 * them and would emit `#include <X.h> void setup();`.
 */
function dropPreprocessorLines(prefix) {
  if (!prefix.includes("#")) return prefix;
  const lines = prefix.split("\n");
  let start = 0;
  for (let index = 0; index < lines.length - 1; index += 1)
    if ((lines[index] ?? "").trimStart().startsWith("#")) start = index + 1;
  return lines.slice(start).join("\n");
}
/** True for a `=` that assigns, ignoring `==`, `<=`, `>=`, `!=` and compound ops. */
function isAssignmentEquals(parameters, index) {
  const previous = parameters[index - 1] ?? "";
  if ((parameters[index + 1] ?? "") === "=") return false;
  return !"<>=!+-*/%&|^".includes(previous);
}
/**
 * Removes `= default` clauses from a parameter list. Repeating a default value
 * in a forward declaration is an error in C++, so the prototype must drop them.
 */
function stripDefaultArguments(parameters) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const character of parameters) {
    if ("([{<".includes(character)) depth += 1;
    if (")]}>".includes(character)) depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts
    .map((part) => {
      for (let index = 0; index < part.length; index += 1)
        if (part[index] === "=" && isAssignmentEquals(part, index))
          return part.slice(0, index).trim();
      return part.trim();
    })
    .join(", ");
}
/**
 * Collects forward declarations for every function defined in the sketch. The
 * Arduino IDE does this so `loop()` may call a helper that is defined below it;
 * without it, perfectly ordinary sketches fail to compile.
 */
function collectPrototypes(sketch) {
  const code = blankLiterals(sketch);
  const prototypes = [];
  const seen = /* @__PURE__ */ new Set();
  let depth = 0;
  for (let index = 0; index < code.length; index += 1) {
    const character = code[index];
    if (character === "}") {
      depth -= 1;
      continue;
    }
    if (character !== "{") continue;
    if (depth !== 0) {
      depth += 1;
      continue;
    }
    depth += 1;
    let closeParen = skipSpaceBackwards(code, index - 1);
    let trailingReturn = "";
    if (code[closeParen] !== ")") {
      const candidate = code.lastIndexOf(")", closeParen);
      if (candidate < 0) continue;
      const between = code.slice(candidate + 1, index).trim();
      if (!between.startsWith("->")) continue;
      trailingReturn = between;
      closeParen = candidate;
    }
    const openParen = matchOpenParen(code, closeParen);
    if (openParen < 0) continue;
    const nameEnd = skipSpaceBackwards(code, openParen - 1);
    const nameStart = identifierStart(code, nameEnd);
    const name = code.slice(nameStart, nameEnd + 1);
    if (name === "" || CONTROL_KEYWORDS.has(name)) continue;
    let cursor = nameStart - 1;
    let nesting = 0;
    while (cursor >= 0) {
      const candidate = code[cursor] ?? "";
      if (")]>".includes(candidate)) nesting += 1;
      if ("([<".includes(candidate)) nesting -= 1;
      if (nesting < 0) nesting = 0;
      if (nesting === 0 && ";{}".includes(candidate)) break;
      cursor -= 1;
    }
    const prefix = dropPreprocessorLines(
      code.slice(cursor + 1, nameStart),
    ).trim();
    const parameters = code.slice(openParen + 1, closeParen);
    if (prefix === "" && trailingReturn === "") continue;
    if (prefix.includes("=") || prefix.includes(",") || prefix.includes("#"))
      continue;
    if (NON_FUNCTION_KEYWORDS.test(prefix)) continue;
    if (prefix.includes("::") || name.includes("::")) continue;
    if (name === "operator" || name.startsWith("operator")) continue;
    const suffix = trailingReturn.startsWith("->") ? ` ${trailingReturn}` : "";
    const normalised =
      `${prefix} ${name}(${stripDefaultArguments(parameters)})${suffix};`
        .replace(/\s+/g, " ")
        .trim();
    if (seen.has(normalised)) continue;
    seen.add(normalised);
    prototypes.push(normalised);
  }
  return prototypes;
}
/**
 * Wraps an Arduino sketch in the translation unit the AVR compiler expects: the
 * core header, the generated prototypes, then the sketch itself, with a `#line`
 * directive so diagnostics point at the lines the user typed.
 */
function buildTranslationUnit(sketch, fileName = "sketch.ino") {
  return {
    source: `${[
      "#include <Arduino.h>",
      ...collectPrototypes(sketch),
      `#line 1 "${fileName}"`,
      "",
    ].join("\n")}${sketch}`,
    fileName,
  };
}
var DIAGNOSTIC_PATTERN =
  /^(?<file>[^:\n]+):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<severity>fatal error|error|warning|note):\s*(?<message>.*)$/;
function toSeverity(raw) {
  if (raw === "warning") return "warning";
  if (raw === "note") return "note";
  return "error";
}
/**
 * Turns raw compiler stderr into diagnostics. Lines that do not look like
 * compiler messages (`In function 'x':`, source echoes) are skipped.
 */
function parseCompilerOutput(output) {
  const diagnostics = [];
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trimEnd();
    if (line === "") continue;
    const match = DIAGNOSTIC_PATTERN.exec(line);
    if (match?.groups === void 0) continue;
    const column = match.groups.column;
    diagnostics.push({
      severity: toSeverity(match.groups.severity ?? "error"),
      line: Number(match.groups.line),
      column: column === void 0 ? null : Number(column),
      message: (match.groups.message ?? "").trim(),
    });
  }
  return diagnostics;
}
var PROGRAM_PATTERN = /Program:\s+(\d+)\s+bytes/;
var DATA_PATTERN = /Data:\s+(\d+)\s+bytes/;
/**
 * Reads `avr-size --format=avr` output. Capacity comes from the board profile,
 * so this stays a pure function of the numbers the tool printed.
 */
function parseSizeOutput(output, flashCapacity, ramCapacity) {
  const program = PROGRAM_PATTERN.exec(output);
  const data = DATA_PATTERN.exec(output);
  if (program?.[1] === void 0 || data?.[1] === void 0) return null;
  return {
    flashBytes: Number(program[1]),
    flashCapacity,
    ramBytes: Number(data[1]),
    ramCapacity,
  };
}
//#endregion
//#region src/main/services/toolchain.ts
/**
 * Real avr-gcc integration, with no Electron dependency so it can be tested
 * directly. The toolchain is vendored into `resources/toolchain/<platform>/` by
 * `scripts/fetch-toolchain.mjs`, so every step here runs offline: no network, no
 * system packages, no shell.
 */
/** Uno profile; the only board milestone 3 supports. */
var BOARD = {
  mcu: "atmega328p",
  variant: "standard",
  defines: [
    "-DF_CPU=16000000L",
    "-DARDUINO=10819",
    "-DARDUINO_AVR_UNO",
    "-DARDUINO_ARCH_AVR",
  ],
  flashCapacity: 32256,
  ramCapacity: 2048,
};
/** A runaway sketch must not hold the compiler hostage. */
var COMPILE_TIMEOUT_MS = 6e4;
/**
 * Describes a toolchain directory, or null when it is not installed. Windows
 * toolchains use `.exe` executables and keep their runtime DLLs next to them,
 * so only the Linux build needs the extra library search path.
 */
function toolchainFromDir(dir, platform = process.platform) {
  const bin = (0, node_path.join)(dir, "bin");
  const exe = platform === "win32" ? ".exe" : "";
  const avrGxx = (0, node_path.join)(bin, `avr-g++${exe}`);
  if (!(0, node_fs.existsSync)(avrGxx)) return null;
  return {
    dir,
    bin,
    hostLibs:
      platform === "linux"
        ? (0, node_path.join)(dir, "lib", "x86_64-linux-gnu")
        : "",
    arduino: (0, node_path.join)(dir, "arduino"),
    coreArchive: (0, node_path.join)(dir, "core", "uno", "core.a"),
    avrGcc: (0, node_path.join)(bin, `avr-gcc${exe}`),
    avrGxx,
    avrObjcopy: (0, node_path.join)(bin, `avr-objcopy${exe}`),
    avrSize: (0, node_path.join)(bin, `avr-size${exe}`),
  };
}
function run(command, args, env, cwd) {
  return new Promise((resolve, reject) => {
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const stdoutPath = (0, node_path.join)(
      (0, node_os.tmpdir)(),
      `vircuitcad-${token}.stdout`,
    );
    const stderrPath = (0, node_path.join)(
      (0, node_os.tmpdir)(),
      `vircuitcad-${token}.stderr`,
    );
    let stdoutFd;
    let stderrFd;
    try {
      stdoutFd = (0, node_fs.openSync)(stdoutPath, "w");
      stderrFd = (0, node_fs.openSync)(stderrPath, "w");
    } catch (error) {
      if (stdoutFd !== void 0) (0, node_fs.closeSync)(stdoutFd);
      if (stderrFd !== void 0) (0, node_fs.closeSync)(stderrFd);
      reject(error);
      return;
    }
    const child = (0, node_child_process.spawn)(command, [...args], {
      cwd,
      env,
      timeout: COMPILE_TIMEOUT_MS,
      stdio: ["ignore", stdoutFd, stderrFd],
    });
    let spawnError = null;
    let timedOut = false;
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code, signal) => {
      timedOut = signal === "SIGTERM" || signal === "SIGKILL";
      try {
        (0, node_fs.closeSync)(stdoutFd);
        (0, node_fs.closeSync)(stderrFd);
      } catch {}
      const stdout = (0, node_fs.readFileSync)(stdoutPath, "utf8");
      const stderr = (0, node_fs.readFileSync)(stderrPath, "utf8");
      (0, node_fs.rmSync)(stdoutPath, { force: true });
      (0, node_fs.rmSync)(stderrPath, { force: true });
      if (spawnError !== null) {
        reject(spawnError);
        return;
      }
      resolve({
        code,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}
function toolchainEnv(toolchain) {
  const env = { ...process.env };
  if (toolchain.hostLibs !== "") env.LD_LIBRARY_PATH = toolchain.hostLibs;
  return env;
}
async function readVersion(command, env) {
  return (
    (
      await run(command, ["--version"], env, (0, node_os.tmpdir)())
    ).stdout.split("\n")[0] ?? ""
  ).trim();
}
/** Libraries the sketch pulls in with `#include <X.h>`, resolved by file name. */
async function resolveLibraries(toolchain, sketch) {
  const librariesRoot = (0, node_path.join)(toolchain.arduino, "libraries");
  if (!(0, node_fs.existsSync)(librariesRoot)) return [];
  const requested = /* @__PURE__ */ new Set();
  for (const match of sketch.matchAll(/^\s*#\s*include\s*<([^>]+)>/gm)) {
    const header = match[1];
    if (header !== void 0) requested.add(header.trim());
  }
  if (requested.size === 0) return [];
  const resolved = [];
  for (const name of await (0, node_fs_promises.readdir)(librariesRoot))
    for (const candidate of [
      (0, node_path.join)(librariesRoot, name),
      (0, node_path.join)(librariesRoot, name, "src"),
    ]) {
      if (
        !requested.has(`${name}.h`) ||
        !(0, node_fs.existsSync)((0, node_path.join)(candidate, `${name}.h`))
      )
        continue;
      const sources = (await (0, node_fs_promises.readdir)(candidate))
        .filter((file) => /\.(c|cpp|S)$/.test(file))
        .map((file) => (0, node_path.join)(candidate, file));
      const utility = (0, node_path.join)(candidate, "utility");
      if ((0, node_fs.existsSync)(utility)) {
        const nested = (await (0, node_fs_promises.readdir)(utility))
          .filter((file) => /\.(c|cpp|S)$/.test(file))
          .map((file) => (0, node_path.join)(utility, file));
        sources.push(...nested);
      }
      resolved.push({
        dir: candidate,
        sources,
      });
    }
  return resolved;
}
function dedupeDiagnostics(diagnostics) {
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.severity}:${diagnostic.line}:${diagnostic.column}:${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(diagnostic);
  }
  return unique;
}
async function compileWithToolchain(toolchain, sketch) {
  const startedAt = Date.now();
  const env = toolchainEnv(toolchain);
  const buildDir = await (0, node_fs_promises.mkdtemp)(
    (0, node_path.join)((0, node_os.tmpdir)(), "vircuitcad-build-"),
  );
  const keepBuild = process.env.VIRCUITCAD_KEEP_BUILD === "1";
  const diagnostics = [];
  try {
    const unit = buildTranslationUnit(sketch, "sketch.ino");
    const sourcePath = (0, node_path.join)(buildDir, `${unit.fileName}.cpp`);
    await (0, node_fs_promises.writeFile)(sourcePath, unit.source);
    const libraries = await resolveLibraries(toolchain, sketch);
    const includeArgs = [
      `-I${(0, node_path.join)(toolchain.arduino, "cores", "arduino")}`,
      `-I${(0, node_path.join)(toolchain.arduino, "variants", BOARD.variant)}`,
      ...libraries.map((library) => `-I${library.dir}`),
    ];
    const compileArgs = [
      `-mmcu=${BOARD.mcu}`,
      ...BOARD.defines,
      "-Os",
      "-g",
      "-ffunction-sections",
      "-fdata-sections",
      "-Wall",
      "-fno-exceptions",
      "-fno-threadsafe-statics",
      ...includeArgs,
    ];
    const sketchObject = (0, node_path.join)(buildDir, "sketch.ino.o");
    const sketchBuild = await run(
      toolchain.avrGxx,
      [...compileArgs, "-c", sourcePath, "-o", sketchObject],
      env,
      buildDir,
    );
    diagnostics.push(...parseCompilerOutput(sketchBuild.stderr));
    const objects = [sketchObject];
    for (const library of libraries)
      for (const source of library.sources) {
        const object = (0, node_path.join)(
          buildDir,
          `${source.replace(/[^\w.-]/g, "_")}.o`,
        );
        const outcome = await run(
          /\.(c|S)$/.test(source) ? toolchain.avrGcc : toolchain.avrGxx,
          [...compileArgs, "-c", source, "-o", object],
          env,
          buildDir,
        );
        diagnostics.push(...parseCompilerOutput(outcome.stderr));
        objects.push(object);
      }
    if (sketchBuild.timedOut)
      diagnostics.push({
        severity: "error",
        line: null,
        column: null,
        message: `Compilation timed out after ${COMPILE_TIMEOUT_MS / 1e3} seconds.`,
      });
    const elfPath = (0, node_path.join)(buildDir, "sketch.elf");
    const linkOutcome = await run(
      toolchain.avrGxx,
      [
        `-mmcu=${BOARD.mcu}`,
        "-Os",
        "-g",
        "-Wl,--gc-sections",
        "-Wl,--relax",
        "-o",
        elfPath,
        ...objects,
        toolchain.coreArchive,
        "-lm",
      ],
      env,
      buildDir,
    );
    diagnostics.push(...parseCompilerOutput(linkOutcome.stderr));
    const unique = dedupeDiagnostics(diagnostics);
    const hasErrors = unique.some(
      (diagnostic) => diagnostic.severity === "error",
    );
    if (!(0, node_fs.existsSync)(elfPath) || hasErrors)
      return {
        ok: false,
        hex: null,
        diagnostics: unique,
        memory: null,
        durationMs: Date.now() - startedAt,
      };
    const hexPath = (0, node_path.join)(buildDir, "sketch.hex");
    const objcopyOutcome = await run(
      toolchain.avrObjcopy,
      ["-O", "ihex", "-R", ".eeprom", elfPath, hexPath],
      env,
      buildDir,
    );
    if (objcopyOutcome.code !== 0 || !(0, node_fs.existsSync)(hexPath))
      return {
        ok: false,
        hex: null,
        diagnostics: dedupeDiagnostics([
          ...unique,
          {
            severity: "error",
            line: null,
            column: null,
            message: objcopyOutcome.stderr.trim() || "avr-objcopy failed.",
          },
        ]),
        memory: null,
        durationMs: Date.now() - startedAt,
      };
    const sizeOutcome = await run(
      toolchain.avrSize,
      ["--mcu", BOARD.mcu, "--format=avr", elfPath],
      env,
      buildDir,
    );
    return {
      ok: true,
      hex: await (0, node_fs_promises.readFile)(hexPath, "utf8"),
      diagnostics: unique,
      memory: parseSizeOutput(
        `${sizeOutcome.stdout}\n${sizeOutcome.stderr}`,
        BOARD.flashCapacity,
        BOARD.ramCapacity,
      ),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      hex: null,
      diagnostics: dedupeDiagnostics([
        ...diagnostics,
        {
          severity: "error",
          line: null,
          column: null,
          message: error instanceof Error ? error.message : String(error),
        },
      ]),
      memory: null,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (!keepBuild)
      await (0, node_fs_promises.rm)(buildDir, {
        recursive: true,
        force: true,
      }).catch(() => {});
  }
}
async function toolchainStatusOf(toolchain) {
  try {
    const version = await readVersion(
      toolchain.avrGxx,
      toolchainEnv(toolchain),
    );
    const hasCore = (0, node_fs.existsSync)(toolchain.coreArchive);
    const manifest = await (0, node_fs_promises.readFile)(
      (0, node_path.join)(toolchain.dir, "manifest.json"),
      "utf8",
    ).catch(() => null);
    return {
      available: hasCore,
      detail: hasCore
        ? version
        : `${version} (the precompiled Arduino core is missing; re-run the toolchain script)`,
      avrGcc: version,
      arduinoCore: readArduinoCoreVersion(manifest),
    };
  } catch (error) {
    return {
      available: false,
      detail: error instanceof Error ? error.message : String(error),
      avrGcc: null,
      arduinoCore: null,
    };
  }
}
var MISSING_TOOLCHAIN_STATUS = {
  available: false,
  detail:
    'Not installed. Reinstall VircuitCAD, or run "node scripts/fetch-toolchain.mjs" in a source checkout.',
  avrGcc: null,
  arduinoCore: null,
};
var MISSING_TOOLCHAIN_RESULT = {
  ok: false,
  hex: null,
  diagnostics: [
    {
      severity: "error",
      line: null,
      column: null,
      message:
        'The Arduino toolchain is missing from this installation. Reinstall VircuitCAD, or run "node scripts/fetch-toolchain.mjs" in a source checkout.',
    },
  ],
  memory: null,
  durationMs: 0,
};
/** Reads `arduinoCore` out of the toolchain manifest, tolerating a missing file. */
function readArduinoCoreVersion(manifest) {
  if (manifest === null) return null;
  try {
    const parsed = JSON.parse(manifest);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "arduinoCore" in parsed
    ) {
      const value = parsed.arduinoCore;
      return typeof value === "string" ? value : null;
    }
  } catch {
    return null;
  }
  return null;
}
//#endregion
//#region src/main/services/compiler.ts
/**
 * Electron-facing wrapper around the vendored toolchain: it only contributes
 * the platform's install locations and serialises concurrent builds.
 */
/**
 * Candidate roots, most specific first: packaged, then dev checkouts. The
 * directory names match electron-builder's `${os}` macro (`win`, `mac`,
 * `linux`), not Node's `process.platform` values.
 */
function toolchainCandidates() {
  const platformDir =
    process.platform === "win32"
      ? "win"
      : process.platform === "darwin"
        ? "mac"
        : "linux";
  return [
    (0, node_path.join)(process.resourcesPath, "toolchain", platformDir),
    (0, node_path.join)(
      electron.app.getAppPath(),
      "resources",
      "toolchain",
      platformDir,
    ),
    (0, node_path.join)(process.cwd(), "resources", "toolchain", platformDir),
  ];
}
function resolveToolchain() {
  for (const dir of toolchainCandidates()) {
    const toolchain = toolchainFromDir(dir);
    if (toolchain !== null) return toolchain;
  }
  return null;
}
/**
 * Compiles are serialised: a classroom machine should not start a second
 * compiler while the first one is still running.
 */
var queue = Promise.resolve();
function compileSketch(sketch) {
  const task = queue.then(async () => {
    const toolchain = resolveToolchain();
    if (toolchain === null) return MISSING_TOOLCHAIN_RESULT;
    return compileWithToolchain(toolchain, sketch);
  });
  queue = task.catch(() => void 0);
  return task;
}
async function readToolchainStatus() {
  const toolchain = resolveToolchain();
  if (toolchain === null) return MISSING_TOOLCHAIN_STATUS;
  return toolchainStatusOf(toolchain);
}
//#endregion
//#region src/main/services/projectFiles.ts
/**
 * File-system side of opening and saving. Electron-free so the round-trip can
 * be tested against a temporary directory; the IPC layer owns the dialogs.
 */
var MAX_FILE_BYTES = 4194304;
var MAX_PNG_BYTES = 33554432;
var MAX_PDF_BYTES = 50331648;
var PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
var PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");
var PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;
var PDF_BASE64 = /^[A-Za-z0-9+/=]+$/;
async function readText(path) {
  const buffer = await (0, node_fs_promises.readFile)(path);
  if (buffer.byteLength > MAX_FILE_BYTES)
    throw new ProjectFileError("The file is too large to open.");
  return buffer.toString("utf8");
}
async function writeProjectFile(path, project) {
  await (0, node_fs_promises.writeFile)(
    path,
    serializeProject(project),
    "utf8",
  );
}
/** Reads either a project or a plain `.ino` sketch, based on the extension. */
async function openFile(path) {
  const kind = openKindForPath(path);
  if (kind === null)
    throw new ProjectFileError(
      "Open a VircuitCAD (.vcc) project or an .ino sketch.",
    );
  const text = await readText(path);
  if (kind === "sketch")
    return {
      kind,
      path,
      sketch: parseSketchText(text),
    };
  return {
    kind,
    path,
    project: parseProjectText(text),
  };
}
async function writeSketchFile(path, sketch) {
  await (0, node_fs_promises.writeFile)(path, parseSketchText(sketch), "utf8");
}
/** Writes a PNG captured by the renderer. The data URL is validated here, not trusted. */
async function writePngFile(path, dataUrl) {
  const payload = PNG_DATA_URL.exec(dataUrl)?.[1];
  if (payload === void 0)
    throw new ProjectFileError("The image data is not a PNG.");
  const buffer = Buffer.from(payload, "base64");
  if (buffer.byteLength > MAX_PNG_BYTES)
    throw new ProjectFileError("The image is too large to export.");
  if (
    buffer.byteLength < PNG_SIGNATURE.length ||
    !buffer.subarray(0, 8).equals(PNG_SIGNATURE)
  )
    throw new ProjectFileError("The image data is not a PNG.");
  await (0, node_fs_promises.writeFile)(path, buffer);
}
/** Writes a vector PDF generated by the renderer. */
async function writePdfFile(path, base64) {
  if (!PDF_BASE64.test(base64))
    throw new ProjectFileError("The document data is not a PDF.");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_PDF_BYTES)
    throw new ProjectFileError("The document is too large to export.");
  if (
    buffer.byteLength < PDF_SIGNATURE.length ||
    !buffer.subarray(0, 5).equals(PDF_SIGNATURE)
  )
    throw new ProjectFileError("The document data is not a PDF.");
  await (0, node_fs_promises.writeFile)(path, buffer);
}
async function writeHexFile(path, hex) {
  if (hex.length > MAX_FILE_BYTES || !hex.startsWith(":"))
    throw new ProjectFileError("There is no compiled HEX to export.");
  await (0, node_fs_promises.writeFile)(
    path,
    hex.endsWith("\n") ? hex : `${hex}\n`,
    "utf8",
  );
}
//#endregion
//#region src/main/services/sampleFiles.ts
/**
 * Shipped example projects. They live outside the app bundle so the installer
 * can ship them as plain, user-inspectable files.
 */
async function listSamples(directory) {
  let names;
  try {
    names = await (0, node_fs_promises.readdir)(directory);
  } catch {
    return [];
  }
  return names
    .filter((name) => SAMPLE_NAME_PATTERN.test(name))
    .sort()
    .map((name) => ({
      name,
      label: sampleLabel(name),
    }));
}
async function readSample(directory, name) {
  if (!SAMPLE_NAME_PATTERN.test(name))
    throw new ProjectFileError("Unknown sample.");
  const opened = await openFile((0, node_path.join)(directory, name));
  if (opened.kind !== "project") throw new ProjectFileError("Unknown sample.");
  return opened;
}
//#endregion
//#region src/main/ipc/index.ts
/** Example projects ship beside the app resources, not inside the asar. */
function samplesDirectory() {
  const candidates = [
    (0, node_path.join)(process.resourcesPath, "samples"),
    (0, node_path.join)(electron.app.getAppPath(), "resources", "samples"),
    (0, node_path.join)(process.cwd(), "resources", "samples"),
  ];
  return (
    candidates.find((candidate) => (0, node_fs.existsSync)(candidate)) ??
    candidates[1]
  );
}
/**
 * Paths the user picked in a dialog during this session. A save may only reuse
 * one of these; otherwise it goes back through a dialog, so a compromised
 * renderer cannot write over an arbitrary file.
 */
var approvedPaths = /* @__PURE__ */ new Set();
/** A file path handed to the app before the renderer was ready to receive it. */
var pendingLaunchPath = null;
function queueLaunchPath(path) {
  pendingLaunchPath = path;
}
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
/** Reads an OS-supplied path in main, then hands the parsed result to the renderer. */
async function deliverOpenFile(window, path) {
  try {
    const opened = await openFile(path);
    approvedPaths.add(path);
    if (!window.isDestroyed())
      window.webContents.send(IpcChannels.fileOpened, opened);
  } catch (error) {
    if (!window.isDestroyed())
      window.webContents.send(IpcChannels.fileOpenError, messageOf(error));
  }
}
function safeBaseName(name, fallback) {
  const cleaned = name
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned === "" ? fallback : cleaned;
}
function ownerWindow(event) {
  return electron.BrowserWindow.fromWebContents(event.sender);
}
async function showOpenDialog(event, options) {
  const window = ownerWindow(event);
  const result = window
    ? await electron.dialog.showOpenDialog(window, options)
    : await electron.dialog.showOpenDialog(options);
  if (result.canceled) return null;
  return result.filePaths[0] ?? null;
}
async function showSaveDialog(event, options) {
  const window = ownerWindow(event);
  const result = window
    ? await electron.dialog.showSaveDialog(window, options)
    : await electron.dialog.showSaveDialog(options);
  if (result.canceled) return null;
  return result.filePath ?? null;
}
async function resolveSavePath(event, requested, extension, options) {
  if (requested !== null && approvedPaths.has(requested))
    return withExtension(requested, extension);
  const picked = await showSaveDialog(event, {
    ...options,
    defaultPath:
      requested === null
        ? options.defaultPath
        : withExtension(requested, extension),
  });
  return picked === null ? null : withExtension(picked, extension);
}
/**
 * Registers every renderer-callable handler. Payloads arrive as `unknown` and are
 * validated here, so a compromised renderer cannot push unexpected shapes into
 * the main process.
 */
function registerIpcHandlers() {
  electron.ipcMain.handle(IpcChannels.ping, (_event, payload) => {
    const request = pingRequestSchema.parse(payload);
    return {
      receivedAt: Date.now(),
      echo: request.sentAt,
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
      },
    };
  });
  electron.ipcMain.handle(IpcChannels.compile, async (_event, payload) => {
    return compileSketch(compileRequestSchema.parse(payload).sketch);
  });
  electron.ipcMain.handle(IpcChannels.toolchainStatus, () => {
    return readToolchainStatus();
  });
  electron.ipcMain.handle(IpcChannels.takeLaunchFile, async () => {
    if (pendingLaunchPath === null) return null;
    const path = pendingLaunchPath;
    pendingLaunchPath = null;
    const opened = await openFile(path);
    approvedPaths.add(path);
    return opened;
  });
  electron.ipcMain.handle(IpcChannels.openFile, async (event) => {
    const path = await showOpenDialog(event, {
      title: "Open project or sketch",
      properties: ["openFile"],
      filters: [
        {
          name: "VircuitCAD project",
          extensions: ["vcc", LEGACY_PROJECT_EXTENSION, "json"],
        },
        {
          name: "Arduino sketch",
          extensions: ["ino"],
        },
      ],
    });
    if (path === null) return null;
    const opened = await openFile(path);
    approvedPaths.add(path);
    return opened;
  });
  electron.ipcMain.handle(IpcChannels.saveProject, async (event, payload) => {
    const request = saveProjectRequestSchema.parse(payload);
    const path = await resolveSavePath(event, request.path, "vcc", {
      title: "Save project",
      defaultPath: `${safeBaseName(request.project.name ?? "untitled", "untitled")}.vcc`,
      filters: [
        {
          name: "VircuitCAD project",
          extensions: ["vcc", LEGACY_PROJECT_EXTENSION],
        },
      ],
    });
    if (path === null) return null;
    await writeProjectFile(path, request.project);
    approvedPaths.add(path);
    return { path };
  });
  electron.ipcMain.handle(IpcChannels.exportSketch, async (event, payload) => {
    const request = exportSketchRequestSchema.parse(payload);
    const path = await resolveSavePath(event, request.path, "ino", {
      title: "Export sketch",
      defaultPath: `sketch.ino`,
      filters: [
        {
          name: "Arduino sketch",
          extensions: ["ino"],
        },
      ],
    });
    if (path === null) return null;
    await writeSketchFile(path, request.sketch);
    approvedPaths.add(path);
    return { path };
  });
  electron.ipcMain.handle(IpcChannels.exportPng, async (event, payload) => {
    const request = exportPngRequestSchema.parse(payload);
    const path = await resolveSavePath(event, request.path, "png", {
      title: "Export PNG",
      defaultPath: `${safeBaseName(request.name, "circuit")}.png`,
      filters: [
        {
          name: "PNG image",
          extensions: ["png"],
        },
      ],
    });
    if (path === null) return null;
    await writePngFile(path, request.dataUrl);
    approvedPaths.add(path);
    return { path };
  });
  electron.ipcMain.handle(IpcChannels.exportPdf, async (event, payload) => {
    const request = exportPdfRequestSchema.parse(payload);
    const path = await resolveSavePath(event, request.path, "pdf", {
      title: "Save schematic as PDF",
      defaultPath: `${safeBaseName(request.name, "schematic")}.pdf`,
      filters: [
        {
          name: "PDF document",
          extensions: ["pdf"],
        },
      ],
    });
    if (path === null) return null;
    await writePdfFile(path, request.data);
    approvedPaths.add(path);
    return { path };
  });
  electron.ipcMain.handle(IpcChannels.listSamples, () => {
    return listSamples(samplesDirectory());
  });
  electron.ipcMain.handle(IpcChannels.openSample, async (_event, payload) => {
    const request = openSampleRequestSchema.parse(payload);
    return readSample(samplesDirectory(), request.name);
  });
  electron.ipcMain.handle(IpcChannels.exportHex, async (event, payload) => {
    const request = exportHexRequestSchema.parse(payload);
    const path = await resolveSavePath(event, request.path, "hex", {
      title: "Export HEX",
      defaultPath: `sketch.hex`,
      filters: [
        {
          name: "Intel HEX",
          extensions: ["hex"],
        },
      ],
    });
    if (path === null) return null;
    await writeHexFile(path, request.hex);
    approvedPaths.add(path);
    return { path };
  });
}
//#endregion
//#region src/main/startup.ts
/**
 * File types the OS may hand to VircuitCAD through argv or macOS `open-file`.
 * Keep this in step with the file association in electron-builder.yml.
 */
var LAUNCH_EXTENSIONS = /* @__PURE__ */ new Set([
  ".vcc",
  ".vircuit",
  ".ino",
  ".json",
]);
/**
 * Finds the project/sketch path in a process argument list. Windows and Linux
 * pass file associations as ordinary argv entries; electron/vite flags and the
 * application path are ignored.
 */
function filePathFromArgs(args, exists = node_fs.existsSync) {
  for (const arg of args) {
    if (arg === "" || arg.startsWith("-")) continue;
    if (!LAUNCH_EXTENSIONS.has((0, node_path.extname)(arg).toLowerCase()))
      continue;
    if (exists(arg)) return arg;
  }
  return null;
}
//#endregion
//#region src/main/index.ts
var rendererUrl = process.env["ELECTRON_RENDERER_URL"];
/** True only when electron-vite's dev server is driving the renderer. */
var isDevServer = !electron.app.isPackaged && rendererUrl !== void 0;
var mainWindow = null;
var launchFile = filePathFromArgs(process.argv);
if (launchFile !== null) queueLaunchPath(launchFile);
/**
 * Strict, offline-only policy: no remote scripts, styles, fonts or connections.
 * Development additionally needs the Vite dev server origin for HMR.
 */
function buildContentSecurityPolicy() {
  const connectSources = ["'self'"];
  const scriptSources = ["'self'"];
  if (isDevServer) {
    connectSources.push("ws://localhost:5173", "http://localhost:5173");
    scriptSources.push("'unsafe-inline'");
  }
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
function hardenSession() {
  const defaultSession = electron.session.defaultSession;
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [buildContentSecurityPolicy()],
      },
    });
  });
  defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  defaultSession.setPermissionCheckHandler(() => false);
}
function createWindow() {
  const window = new electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#050d1a",
    title: APP_NAME,
    webPreferences: {
      preload: (0, node_path.join)(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  window.once("ready-to-show", () => {
    window.show();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  if (isDevServer)
    window.webContents.on("console-message", (details) => {
      console.log(`[renderer:${details.level}] ${details.message}`);
    });
  if (isDevServer && rendererUrl !== void 0) window.loadURL(rendererUrl);
  else
    window.loadFile((0, node_path.join)(__dirname, "../renderer/index.html"));
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  return window;
}
function focusWindow(window) {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
/** Routes a file opened by the OS to the renderer, or queues it until startup. */
function acceptOpenedFile(path) {
  const window = mainWindow;
  if (window === null || window.webContents.isLoadingMainFrame()) {
    queueLaunchPath(path);
    if (window !== null) focusWindow(window);
    return;
  }
  focusWindow(window);
  deliverOpenFile(window, path);
}
electron.app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event) => {
    event.preventDefault();
  });
});
if (!electron.app.requestSingleInstanceLock()) electron.app.quit();
else {
  electron.app.on("second-instance", (_event, argv) => {
    const path = filePathFromArgs(argv);
    if (path !== null) acceptOpenedFile(path);
    else if (mainWindow !== null) focusWindow(mainWindow);
  });
  electron.app.on("open-file", (event, path) => {
    event.preventDefault();
    acceptOpenedFile(path);
  });
  electron.app.whenReady().then(() => {
    hardenSession();
    registerIpcHandlers();
    mainWindow = createWindow();
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0)
        mainWindow = createWindow();
    });
  });
  electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") electron.app.quit();
  });
}
//#endregion

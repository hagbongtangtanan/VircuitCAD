import { z } from 'zod';

import { createId } from './ids';

export const SCHEMA_VERSION = 2;

export const Vec2Schema = z.object({ x: z.number().int(), y: z.number().int() });
export type Vec2 = z.infer<typeof Vec2Schema>;

export const RotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
export type Rotation = z.infer<typeof RotationSchema>;

export const BoardKindSchema = z.enum(['full', 'half']);
export type BoardKind = z.infer<typeof BoardKindSchema>;

export const BoardSchema = z.object({
  id: z.string().min(1),
  kind: BoardKindSchema,
});
export type Board = z.infer<typeof BoardSchema>;

export const ParamValueSchema = z.union([z.number(), z.string(), z.boolean()]);
export type ParamValue = z.infer<typeof ParamValueSchema>;

export const PinRefSchema = z.object({
  kind: z.literal('pin'),
  partId: z.string().min(1),
  pinId: z.string().min(1),
});
export type PinRef = z.infer<typeof PinRefSchema>;

export const HoleRefSchema = z.object({
  kind: z.literal('hole'),
  holeId: z.string().min(1),
});
export type HoleRef = z.infer<typeof HoleRefSchema>;

export const EndpointSchema = z.discriminatedUnion('kind', [PinRefSchema, HoleRefSchema]);
export type Endpoint = z.infer<typeof EndpointSchema>;

export const PartInstanceSchema = z.object({
  id: z.string().min(1),
  partId: z.string().min(1),
  position: Vec2Schema,
  rotation: RotationSchema,
  params: z.record(z.string(), ParamValueSchema),
});
export type PartInstance = z.infer<typeof PartInstanceSchema>;

export const WireColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const WireSchema = z.object({
  id: z.string().min(1),
  from: EndpointSchema,
  to: EndpointSchema,
  waypoints: z.array(Vec2Schema),
  color: WireColorSchema,
});
export type Wire = z.infer<typeof WireSchema>;

export const SketchSchema = z.object({
  files: z.record(z.string(), z.string()),
});
export type Sketch = z.infer<typeof SketchSchema>;

/** How the project's program is authored: visual blocks or handwritten text. */
export const ProjectModeSchema = z.enum(['blocks', 'text']);
export type ProjectMode = z.infer<typeof ProjectModeSchema>;

/** Serialized Blockly workspace (opaque to core; the editor owns its shape). */
export const BlocksSchema = z.record(z.string(), z.unknown());
export type Blocks = z.infer<typeof BlocksSchema>;

export const DEFAULT_SKETCH_FILE = 'sketch.ino';

export function defaultSketch(): Sketch {
  return {
    files: { [DEFAULT_SKETCH_FILE]: 'void setup() {\n}\n\nvoid loop() {\n}\n' },
  };
}

export const CircuitSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  board: BoardSchema,
  parts: z.array(PartInstanceSchema),
  wires: z.array(WireSchema),
  sketch: SketchSchema.optional(),
  mode: ProjectModeSchema.optional(),
  blocks: BlocksSchema.optional(),
});
export type Circuit = z.infer<typeof CircuitSchema>;

/** The sketch, or a default empty sketch when the document predates sketches. */
export function sketchOf(circuit: Circuit): Sketch {
  return circuit.sketch ?? defaultSketch();
}

/** The project program mode, defaulting to text for documents that predate blocks. */
export function modeOf(circuit: Circuit): ProjectMode {
  return circuit.mode ?? 'text';
}

export const DEFAULT_WIRE_COLOR = '#22c55e';

export function rotateGridVector(vec: Vec2, rotation: Rotation): Vec2 {
  switch (rotation) {
    case 0:
      return vec;
    case 90:
      return { x: -vec.y, y: vec.x };
    case 180:
      return { x: -vec.x, y: -vec.y };
    case 270:
      return { x: vec.y, y: -vec.x };
  }
}

export function createBoard(kind: BoardKind = 'full', id: string = createId()): Board {
  return { id, kind };
}

export function createEmptyCircuit(
  options: { name?: string; board?: BoardKind; mode?: ProjectMode } = {},
): Circuit {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    name: options.name ?? 'Untitled circuit',
    board: createBoard(options.board ?? 'full'),
    parts: [],
    wires: [],
    sketch: defaultSketch(),
    mode: options.mode ?? 'text',
  };
}

export function createPartInstance(
  partId: string,
  options: {
    id?: string;
    position?: Vec2;
    rotation?: Rotation;
    params?: Record<string, ParamValue>;
  } = {},
): PartInstance {
  return {
    id: options.id ?? createId(),
    partId,
    position: options.position ?? { x: 0, y: 0 },
    rotation: options.rotation ?? 0,
    params: options.params ?? {},
  };
}

export function createWire(
  from: Endpoint,
  to: Endpoint,
  options: { id?: string; waypoints?: Vec2[]; color?: string } = {},
): Wire {
  return {
    id: options.id ?? createId(),
    from,
    to,
    waypoints: options.waypoints ?? [],
    color: options.color ?? DEFAULT_WIRE_COLOR,
  };
}

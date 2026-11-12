export { Editor, type EditorOptions } from './editor';
export { SimulationHost } from './sim/worker-host';
export { McuHost } from './sim/mcu-host';
export { McuCircuit } from './sim/cosim';
export {
  markersByFile,
  toMarkers,
  type CompileDiagnostic,
  type Marker,
} from './sim/diagnostics';
export {
  RunController,
  type CompileOutcome,
  type RunControllerDeps,
  type RunState,
} from './sim/run-controller';
export { Scene, type PreviewState, type SceneOptions } from './render/scene';
export {
  ToolController,
  type ToolControllerDeps,
  type ToolName,
} from './tools/tool-controller';
export {
  boardGridBounds,
  isPlacementValid,
  partGridBounds,
  rectsOverlap,
  snapPartPosition,
  type GridRect,
  type HoleLookup,
  type SnapResult,
} from './tools/placement';
export {
  HitTester,
  buildHitTestScene,
  type Hit,
  type HitKind,
  type HitTestScene,
  type Rect,
} from './hit/scene-index';
export { layoutPart, type PartBounds, type PartLayout, type PartPinLayout } from './render/part-layout';
export { TextureCache } from './render/texture-cache';
export { partTextureKey, type ArtVariant } from './render/texture-key';
export { buildPartArtContainer } from './render/art-graphics';
export { createPartTexture, createPlaceholderPartTexture } from './render/part-textures';
export { ledGlow, ledTint, voltageToColor } from './render/visuals';
export {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Vec2,
  type Viewport,
} from './viewport';

export const packageName = '@vircuitcad/editor';

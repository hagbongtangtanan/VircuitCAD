export { Editor, type EditorOptions } from './editor';
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

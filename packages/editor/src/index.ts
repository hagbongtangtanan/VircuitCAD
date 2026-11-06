export { Editor, type EditorOptions } from './editor';
export { Scene, type SceneOptions } from './render/scene';
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

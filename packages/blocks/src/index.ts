export {
  binary,
  number,
  variable,
  type BinaryOperator,
  type Expr,
  type Program,
  type Statement,
} from './ir';
export { generateArduino, generateExpression } from './generate';
export { ARDUINO_BLOCK_DEFINITIONS, ARDUINO_BLOCK_TYPES } from './definitions';
export { TOOLBOX, TOOLBOX_CATEGORIES } from './toolbox';
export type { Toolbox, ToolboxBlock, ToolboxCategory } from './toolbox';
export { workspaceToProgram } from './mapper';
export type { BlockLike, WorkspaceLike } from './mapper';
export { REFERENCE_PROGRAMS } from './programs';

export const packageName = '@vircuitcad/blocks';

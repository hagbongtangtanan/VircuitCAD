import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as EnModule from 'blockly/msg/en';

import { ARDUINO_BLOCK_DEFINITIONS } from './definitions';

const localeMessages: Record<string, string> = {};
for (const [key, value] of Object.entries(EnModule)) {
  if (typeof value === 'string') localeMessages[key] = value;
}
Blockly.setLocale(localeMessages);

let registered = false;

type Definitions = Parameters<typeof Blockly.common.createBlockDefinitionsFromJsonArray>[0];

/** Registers the custom Arduino blocks with Blockly (idempotent). */
export function registerArduinoBlocks(): void {
  if (registered) return;
  const definitions = Blockly.common.createBlockDefinitionsFromJsonArray(
    ARDUINO_BLOCK_DEFINITIONS as unknown as Definitions,
  );
  Blockly.common.defineBlocks(definitions);
  registered = true;
}

export { workspaceToProgram } from './mapper';
export type { BlockLike, WorkspaceLike } from './mapper';
export { TOOLBOX, TOOLBOX_CATEGORIES } from './toolbox';
export type { Toolbox, ToolboxBlock, ToolboxCategory } from './toolbox';

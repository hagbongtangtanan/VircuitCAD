import { expect, it } from 'vitest';

import { buildMenuTemplate, type MenuItemSpec } from './menu';

function leaves(spec: MenuItemSpec): MenuItemSpec[] {
  if (spec.submenu) return spec.submenu.flatMap(leaves);
  if (spec.type === 'separator') return [];
  return [spec];
}

const allLeaves = (template: MenuItemSpec[]): MenuItemSpec[] => template.flatMap(leaves);

it('has the File / Edit / View / Help menus', () => {
  expect(buildMenuTemplate({ version: '0.1.0', isDev: false }).map((m) => m.label)).toEqual([
    'File',
    'Edit',
    'View',
    'Help',
  ]);
});

it('every leaf item either runs a command or is a role', () => {
  for (const item of allLeaves(buildMenuTemplate({ version: '0.1.0', isDev: false }))) {
    expect(Boolean(item.command) || Boolean(item.role), item.label).toBe(true);
  }
});

it('exposes the documented commands with accelerators', () => {
  const commands = new Map(
    allLeaves(buildMenuTemplate({ version: '0.1.0', isDev: false }))
      .filter((item) => item.command)
      .map((item) => [item.command, item]),
  );
  for (const command of [
    'file.new',
    'file.open',
    'file.save',
    'file.saveAs',
    'file.export',
    'edit.undo',
    'edit.redo',
    'edit.duplicate',
    'edit.selectAll',
    'view.zoomIn',
    'view.zoomOut',
    'view.zoomReset',
    'view.zoomFit',
    'view.toggleGrid',
    'view.togglePanels',
    'view.toggleTheme',
    'help.about',
    'help.shortcuts',
    'help.licenses',
  ] as const) {
    expect(commands.get(command), command).toBeDefined();
  }
  expect(commands.get('edit.undo')?.accelerator).toBe('CmdOrCtrl+Z');
  expect(commands.get('file.save')?.accelerator).toBe('CmdOrCtrl+S');
});

it('omits developer items in production and adds them in dev', () => {
  const prod = buildMenuTemplate({ version: '0.1.0', isDev: false });
  expect(prod.map((m) => m.label)).not.toContain('Developer');

  const dev = buildMenuTemplate({ version: '0.1.0', isDev: true });
  expect(dev.map((m) => m.label)).toContain('Developer');
});

it('shows the version in Help > About', () => {
  const help = buildMenuTemplate({ version: '9.9.9', isDev: false }).find((m) => m.label === 'Help');
  const about = help?.submenu?.find((item) => item.command === 'help.about');
  expect(about?.label).toContain('9.9.9');
});

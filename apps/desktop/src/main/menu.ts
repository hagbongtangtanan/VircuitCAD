/** Application menu template (pure data; applied to Electron in the main process). */

export type MenuCommand =
  | 'file.new'
  | 'file.open'
  | 'file.save'
  | 'file.saveAs'
  | 'file.export'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.delete'
  | 'edit.selectAll'
  | 'edit.duplicate'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.zoomReset'
  | 'view.zoomFit'
  | 'view.toggleGrid'
  | 'view.togglePanels'
  | 'view.toggleTheme'
  | 'help.about'
  | 'help.shortcuts'
  | 'help.licenses';

export type MenuItemSpec = {
  label?: string;
  accelerator?: string;
  command?: MenuCommand;
  role?: string;
  type?: 'separator';
  submenu?: MenuItemSpec[];
};

const sep: MenuItemSpec = { type: 'separator' };

export type MenuInfo = { version: string; isDev: boolean };

/** File / Edit / View / Help menus; dev-only items are omitted in production. */
export function buildMenuTemplate(info: MenuInfo): MenuItemSpec[] {
  const template: MenuItemSpec[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', command: 'file.new' },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', command: 'file.open' },
        sep,
        { label: 'Save', accelerator: 'CmdOrCtrl+S', command: 'file.save' },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', command: 'file.saveAs' },
        sep,
        { label: 'Export…', accelerator: 'CmdOrCtrl+E', command: 'file.export' },
        sep,
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', command: 'edit.undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', command: 'edit.redo' },
        sep,
        { label: 'Duplicate', accelerator: 'CmdOrCtrl+D', command: 'edit.duplicate' },
        { label: 'Delete', accelerator: 'Delete', command: 'edit.delete' },
        sep,
        { label: 'Select all', accelerator: 'CmdOrCtrl+A', command: 'edit.selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom in', accelerator: 'CmdOrCtrl+=', command: 'view.zoomIn' },
        { label: 'Zoom out', accelerator: 'CmdOrCtrl+-', command: 'view.zoomOut' },
        { label: 'Zoom reset', accelerator: 'CmdOrCtrl+0', command: 'view.zoomReset' },
        { label: 'Fit to view', accelerator: 'CmdOrCtrl+1', command: 'view.zoomFit' },
        sep,
        { label: 'Toggle grid', accelerator: 'CmdOrCtrl+G', command: 'view.toggleGrid' },
        { label: 'Toggle panels', accelerator: 'CmdOrCtrl+B', command: 'view.togglePanels' },
        { label: 'Toggle theme', accelerator: 'CmdOrCtrl+Shift+L', command: 'view.toggleTheme' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: `About VircuitCAD ${info.version}`, command: 'help.about' },
        { label: 'Keyboard shortcuts', accelerator: 'F1', command: 'help.shortcuts' },
        { label: 'Licenses', command: 'help.licenses' },
      ],
    },
  ];

  if (info.isDev) {
    template.push({
      label: 'Developer',
      submenu: [
        { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
      ],
    });
  }

  return template;
}

import path from 'node:path';

import {
  BrowserWindow,
  Menu,
  app,
  ipcMain,
  session,
  type MenuItemConstructorOptions,
} from 'electron';

import { handleRpc } from '@vircuitcad/core';

import { createElectronPlatformAdapter } from './adapter';
import { buildMenuTemplate, type MenuItemSpec } from './menu';

export const MENU_CHANNEL = 'vircuitcad:menu';

function toMenuItem(spec: MenuItemSpec): MenuItemConstructorOptions {
  if (spec.type === 'separator') return { type: 'separator' };
  const item: MenuItemConstructorOptions = {};
  if (spec.label !== undefined) item.label = spec.label;
  if (spec.accelerator !== undefined) item.accelerator = spec.accelerator;
  if (spec.role !== undefined) {
    item.role = spec.role as NonNullable<MenuItemConstructorOptions['role']>;
  }
  if (spec.submenu) {
    item.submenu = spec.submenu.map(toMenuItem);
  } else if (spec.command) {
    const command = spec.command;
    item.click = () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(MENU_CHANNEL, command);
    };
  }
  return item;
}

function applyMenu(): void {
  const template = buildMenuTemplate({ version: app.getVersion(), isDev: !app.isPackaged });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template.map(toMenuItem)));
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

const rendererUrl = process.env.VC_DEV_SERVER_URL;

function applyContentSecurityPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] },
    });
  });
}

function registerIpc(): void {
  const adapter = createElectronPlatformAdapter();
  ipcMain.handle('vircuitcad:rpc', (_event, request: unknown) => handleRpc(adapter, request));
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  applyContentSecurityPolicy();
  registerIpc();
  applyMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

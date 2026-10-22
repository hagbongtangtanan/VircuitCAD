import { app, BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { APP_NAME } from '../shared/app'
import { deliverOpenFile, queueLaunchPath, registerIpcHandlers } from './ipc'
import { filePathFromArgs } from './startup'

const rendererUrl = process.env['ELECTRON_RENDERER_URL']
/** True only when electron-vite's dev server is driving the renderer. */
const isDevServer = !app.isPackaged && rendererUrl !== undefined

let mainWindow: BrowserWindow | null = null

const launchFile = filePathFromArgs(process.argv)
if (launchFile !== null) queueLaunchPath(launchFile)

/**
 * Strict, offline-only policy: no remote scripts, styles, fonts or connections.
 * Development additionally needs the Vite dev server origin for HMR.
 */
function buildContentSecurityPolicy(): string {
  const connectSources = ["'self'"]
  // Vite's React Fast Refresh preamble is an inline script and the dev client
  // talks to the dev server over websockets. Production keeps the strict values.
  const scriptSources = ["'self'"]
  if (isDevServer) {
    connectSources.push('ws://localhost:5173', 'http://localhost:5173')
    scriptSources.push("'unsafe-inline'")
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}

function hardenSession(): void {
  const defaultSession = session.defaultSession

  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [buildContentSecurityPolicy()],
      },
    })
  })

  defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  defaultSession.setPermissionCheckHandler(() => false)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#eef1f6',
    title: APP_NAME,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  // Nothing in this app may open a new window or navigate away from itself.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (isDevServer) {
    window.webContents.on('console-message', (details) => {
      console.log(`[renderer:${details.level}] ${details.message}`)
    })
  }

  if (isDevServer && rendererUrl !== undefined) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  return window
}

function focusWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

/** Routes a file opened by the OS to the renderer, or queues it until startup. */
function acceptOpenedFile(path: string): void {
  const window = mainWindow
  if (window === null || window.webContents.isLoadingMainFrame()) {
    queueLaunchPath(path)
    if (window !== null) focusWindow(window)
    return
  }
  focusWindow(window)
  void deliverOpenFile(window, path)
}

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event) => {
    event.preventDefault()
  })
})

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const path = filePathFromArgs(argv)
    if (path !== null) acceptOpenedFile(path)
    else if (mainWindow !== null) focusWindow(mainWindow)
  })

  // macOS delivers Finder double-clicks through this event, often before the
  // window or renderer exists, so the path is queued for the first mount.
  app.on('open-file', (event, path) => {
    event.preventDefault()
    acceptOpenedFile(path)
  })

  void app.whenReady().then(() => {
    hardenSession()
    registerIpcHandlers()
    mainWindow = createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

// Smoke-tests a running Electron build over the Chrome DevTools Protocol.
//
// Usage:
//   npm run dev -- --noSandbox --remoteDebuggingPort 9222   # or:
//   electron out/main/index.js --no-sandbox --remote-debugging-port=9223
//   CDP_HOST=http://127.0.0.1:9223 node scripts/verify-electron.mjs
//
// Asserts that the renderer mounted, the `window.api.ping` IPC round trip works,
// and that the window logged no console errors or CSP violations. Exits non-zero
// on failure so it can gate CI. With EXPECT_CANVAS=1 it additionally drives the
// editor: places a part from the drawer and wires two pins through the real
// canvas event path.

const CDP_HOST = process.env.CDP_HOST ?? 'http://127.0.0.1:9222'
const WAIT_MS = Number(process.env.CDP_WAIT_MS ?? 60000)
// Set EXPECT_CANVAS=1 once the circuit editor is part of the shell.
const EXPECT_CANVAS = process.env.EXPECT_CANVAS === '1'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function findPageTarget() {
  const deadline = Date.now() + WAIT_MS
  let lastError = 'no response'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${CDP_HOST}/json/list`)
      const targets = await response.json()
      const page = targets.find(
        (target) => target.type === 'page' && typeof target.webSocketDebuggerUrl === 'string'
      )
      if (page) return page
      lastError = `no page target yet (${targets.length} targets)`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await sleep(500)
  }
  throw new Error(`Timed out waiting for a CDP page target: ${lastError}`)
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.addEventListener('open', () => resolve(socket), { once: true })
    socket.addEventListener('error', () => reject(new Error(`Failed to connect to ${url}`)), {
      once: true,
    })
  })
}

const page = await findPageTarget()
console.log(`CDP page target: ${page.url}`)

const socket = await connect(page.webSocketDebuggerUrl)

let nextId = 1
const pending = new Map()
const consoleErrors = []
const cspViolations = []

socket.addEventListener('message', (event) => {
  const payload = JSON.parse(event.data)
  if (typeof payload.id === 'number') {
    const entry = pending.get(payload.id)
    if (entry) {
      pending.delete(payload.id)
      entry(payload)
    }
    return
  }
  if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') {
    const text = payload.params.args
      .map((arg) => arg.value ?? arg.description ?? arg.type)
      .join(' ')
    consoleErrors.push(text)
  }
  if (payload.method === 'Log.entryAdded') {
    const { level, source, text } = payload.params.entry
    if (level === 'error' && source === 'security') cspViolations.push(text)
  }
})

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`CDP call ${method} timed out`))
    }, 20000)
    pending.set(id, (payload) => {
      clearTimeout(timer)
      if (payload.error) reject(new Error(`${method}: ${payload.error.message}`))
      else resolve(payload.result)
    })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

await send('Runtime.enable')
await send('Log.enable')
await sleep(2500)

const evaluation = await send('Runtime.evaluate', {
  expression: `(async () => {
    let pingOk = false
    let pingError = null
    let versions = null
    try {
      const response = await window.api.ping({ sentAt: 4242 })
      versions = response.versions
      pingOk = response.echo === 4242
    } catch (error) {
      pingError = String(error)
    }
    return {
      apiType: typeof window.api,
      pingType: typeof window.api?.ping,
      pingOk,
      pingError,
      versions,
      rootChildren: document.getElementById('root')?.childElementCount ?? 0,
    }
  })()`,
  awaitPromise: true,
  returnByValue: true,
})

const value = evaluation.result.value
console.log('renderer probe:', JSON.stringify(value, null, 2))
let interaction = null
if (EXPECT_CANVAS) {
  const probe = await send('Runtime.evaluate', {
    expression: `(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const counts = () => document.querySelector('[data-testid="scene-counts"]')?.textContent ?? ''
      // The Vite dev server can trigger a one-off reload while it pre-bundles
      // dependencies, so wait for the editor to actually be on screen.
      let led = null
      for (let attempt = 0; attempt < 80 && led === null; attempt += 1) {
        await sleep(250)
        led = document.querySelector('[data-part-type="led"]')
      }
      const before = counts()
      if (!led) return { error: 'parts drawer did not render an led button' }
      led.click()
      await sleep(100)
      const afterAdd = counts()
      const stage = document.querySelector('.circuit-canvas canvas')
      const rect = stage?.getBoundingClientRect()
      // The LED is placed by the drawer at world (60, 80) and the canvas starts
      // with a (60, 60) offset at scale 1, so both pins are easy to locate.
      const viewportOffset = { x: 60, y: 60 }
      const pinTargets =
        rect === null || rect === undefined
          ? []
          : [
              { x: rect.left + viewportOffset.x + 70, y: rect.top + viewportOffset.y + 120 },
              { x: rect.left + viewportOffset.x + 90, y: rect.top + viewportOffset.y + 120 },
            ]
      return {
        before,
        afterAdd,
        pinTargets,
        canvasCount: document.querySelectorAll('.circuit-canvas canvas').length,
        canvasSize: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
        hasDrawer: document.querySelector('[data-testid="part-drawer"]') !== null,
        hasInspector: document.querySelector('[data-testid="inspector"]') !== null,
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  interaction = probe.result.value
  console.log('editor probe:', JSON.stringify(interaction, null, 2))

  // Click both LED pins so a wire is created through the real Konva event path.
  for (const target of interaction.pinTargets ?? []) {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', {
        type,
        x: target.x,
        y: target.y,
        button: 'left',
        clickCount: 1,
        buttons: type === 'mousePressed' ? 1 : 0,
      })
    }
    await sleep(150)
  }
  const wired = await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-testid="scene-counts"]')?.textContent ?? ''`,
    returnByValue: true,
  })
  interaction.afterWire = wired.result.value
  console.log(`after wiring both led pins: ${interaction.afterWire}`)
  await sleep(500)
}

console.log(`console errors: ${consoleErrors.length}`)
for (const line of consoleErrors) console.log(`  - ${line}`)
console.log(`csp violations: ${cspViolations.length}`)
for (const line of cspViolations) console.log(`  - ${line}`)

socket.close()

const failures = []
if (value.rootChildren < 1) failures.push('renderer rendered no DOM')
if (value.apiType !== 'object') failures.push('window.api missing')
if (value.pingType !== 'function') failures.push('window.api.ping missing')
if (!value.pingOk) failures.push(`ping round trip failed: ${value.pingError}`)
if (consoleErrors.length > 0) failures.push(`${consoleErrors.length} console error(s)`)
if (cspViolations.length > 0) failures.push(`${cspViolations.length} CSP violation(s)`)

if (EXPECT_CANVAS) {
  if (interaction === null) failures.push('editor probe did not run')
  else if (interaction.error !== undefined) failures.push(`editor probe: ${interaction.error}`)
  else {
    if (!interaction.hasDrawer) failures.push('parts drawer missing')
    if (!interaction.hasInspector) failures.push('inspector missing')
    if (interaction.canvasCount < 1) failures.push('circuit canvas missing')
    if (interaction.canvasSize === null || interaction.canvasSize.width < 100) {
      failures.push(`circuit canvas has no layout (${JSON.stringify(interaction.canvasSize)})`)
    }
    const parseCounts = (text) => {
      const match = /^(\d+) parts · (\d+) wires · (\d+) nets$/.exec(text ?? '')
      return match
        ? { parts: Number(match[1]), wires: Number(match[2]), nets: Number(match[3]) }
        : null
    }
    const before = parseCounts(interaction.before)
    const after = parseCounts(interaction.afterAdd)
    if (before === null || after === null) {
      failures.push('scene counts did not render')
    } else if (after.parts !== before.parts + 1) {
      failures.push(
        `placing a part did not add exactly one part: ${interaction.before} -> ${interaction.afterAdd}`
      )
    }
    const wired = parseCounts(interaction.afterWire)
    if (wired === null) {
      failures.push('scene counts disappeared after wiring')
    } else if (wired.wires !== after?.wires + 1) {
      failures.push(`clicking two pins did not create a wire: ${interaction.afterWire}`)
    } else if (wired.nets !== after.nets - 1) {
      failures.push(`wiring the two led pins did not merge their nets: ${interaction.afterWire}`)
    }
  }
}

if (failures.length > 0) {
  console.error('\nFAIL:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('\nPASS: window rendered, IPC round trip ok, no console errors, no CSP violations')

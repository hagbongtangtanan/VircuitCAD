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
// Set EXPECT_EDITOR=1 to also compile the default sketch through the toolchain.
const EXPECT_EDITOR = process.env.EXPECT_EDITOR === '1'
// Set EXPECT_SIM=1 to run the compiled sketch on avr8js and wait for Serial output.
const EXPECT_SIM = process.env.EXPECT_SIM === '1'

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
      const projectBefore =
        document.querySelector('[data-testid="project-status"]')?.textContent ?? ''
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
        projectBefore,
        projectAfter: document.querySelector('[data-testid="project-status"]')?.textContent ?? '',
        hasFileButtons: ['file-new', 'file-open', 'file-save'].every(
          (id) => document.querySelector('[data-testid="' + id + '"]') !== null
        ),
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

let editor = null
if (EXPECT_EDITOR) {
  const probe = await send('Runtime.evaluate', {
    expression: `(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const text = (selector) => document.querySelector(selector)?.textContent ?? ''
      const waitFor = async (predicate, attempts, intervalMs) => {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const value = predicate()
          if (value) return value
          await sleep(intervalMs)
        }
        return null
      }

      // The dev server may reload once while it pre-bundles dependencies, which
      // detaches any element we grabbed, so re-query the tab on every attempt.
      let editorReady = null
      for (let attempt = 0; attempt < 40 && editorReady === null; attempt += 1) {
        const tab = [...document.querySelectorAll('button[role="tab"]')].find(
          (button) => (button.textContent ?? '').trim() === 'Code'
        )
        if (tab) tab.click()
        await sleep(250)
        editorReady = document.querySelector('.cm-editor')
      }
      const buildButton = document.querySelector('[data-testid="build-button"]')
      if (!buildButton) return { error: 'no build button' }
      buildButton.click()

      // The click only flips the status once React re-renders, so wait for a
      // terminal message instead of the first non-"Compiling" string.
      const buildStatus = await waitFor(
        () => {
          const value = text('[data-testid="build-status"]')
          const finished =
            value.startsWith('Compiled in') ||
            value.startsWith('Build failed') ||
            value.includes('toolchain is not installed') ||
            value.includes('failed')
          return finished ? value : null
        },
        120,
        500
      )

      return {
        hasEditor: editorReady !== null,
        hasSerialMonitor: document.querySelector('[data-testid="serial-monitor"]') !== null,
        buildStatus,
        diagnosticCount: document.querySelectorAll('[data-testid="diagnostic-list"] li').length,
        toolchain: text('[data-testid="toolchain-status"]'),
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  editor = probe.result.value
  console.log('editor probe:', JSON.stringify(editor, null, 2))
  await sleep(500)
}

let simulation = null
if (EXPECT_SIM) {
  const probe = await send('Runtime.evaluate', {
    expression: `(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const text = (selector) => document.querySelector(selector)?.textContent ?? ''
      const waitFor = async (predicate, attempts, intervalMs) => {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const value = predicate()
          if (value) return value
          await sleep(intervalMs)
        }
        return null
      }

      const codeTab = [...document.querySelectorAll('button[role="tab"]')].find(
        (button) => (button.textContent ?? '').trim() === 'Code'
      )
      codeTab?.click()
      await sleep(300)

      const simButton = document.querySelector('[data-testid="sim-button"]')
      if (!simButton) return { error: 'no simulation button' }
      simButton.click()

      const running = await waitFor(
        () => text('[data-testid="sim-status"]').includes('simulating'),
        240,
        250
      )
      const serial = await waitFor(() => {
        const lines = [...document.querySelectorAll('.serial-line')].map(
          (element) => element.textContent ?? ''
        )
        return lines.length >= 2 ? lines.slice(0, 4) : null
      }, 240, 250)
      const readout = text('[data-testid="sim-readout"]')

      simButton.click()
      await sleep(300)

      return {
        running: running !== null,
        serial,
        readout,
        stopped: text('[data-testid="sim-status"]'),
        error: text('[data-testid="sim-readout"]').includes('error'),
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  simulation = probe.result.value
  console.log('simulation probe:', JSON.stringify(simulation, null, 2))
  await sleep(300)
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
    if (!interaction.projectBefore?.includes('untitled')) {
      failures.push(`unexpected project label before editing: ${interaction.projectBefore}`)
    }
    if (!interaction.projectAfter?.includes('unsaved changes')) {
      failures.push(`editing did not mark the project dirty: ${interaction.projectAfter}`)
    }
    if (!interaction.hasFileButtons) failures.push('the file buttons did not render')

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

if (EXPECT_EDITOR) {
  if (editor === null) failures.push('editor probe did not run')
  else if (editor.error !== undefined) failures.push(`editor probe: ${editor.error}`)
  else {
    if (!editor.hasEditor) failures.push('the Arduino editor did not render')
    if (!editor.hasSerialMonitor) failures.push('the serial monitor did not render')
    if (editor.buildStatus === null) failures.push('the build never finished')
    else if (!/^Compiled in \d+ ms · flash \d+\/32256 B/.test(editor.buildStatus)) {
      failures.push(`unexpected build result: "${editor.buildStatus}"`)
    }
    if (editor.diagnosticCount > 0) {
      failures.push(`the default sketch produced ${editor.diagnosticCount} diagnostic(s)`)
    }
    if (/unavailable/.test(editor.toolchain)) {
      failures.push(`toolchain reported unavailable: ${editor.toolchain}`)
    }
  }
}

if (EXPECT_SIM) {
  if (simulation === null) failures.push('simulation probe did not run')
  else if (typeof simulation.error === 'string')
    failures.push(`simulation probe: ${simulation.error}`)
  else {
    if (simulation.error === true) failures.push('the simulation reported an error')
    if (!simulation.running) failures.push('the simulation never reached the running state')
    if (!Array.isArray(simulation.serial)) failures.push('no serial output arrived')
    else if (!simulation.serial.includes('LED on')) {
      failures.push(`unexpected serial output: ${JSON.stringify(simulation.serial)}`)
    }
    if (!/running/.test(simulation.readout)) {
      failures.push(`unexpected simulation readout: ${simulation.readout}`)
    }
    if (!/stopped/.test(simulation.stopped)) {
      failures.push(`the simulation did not stop: ${simulation.stopped}`)
    }
  }
}

if (failures.length > 0) {
  console.error('\nFAIL:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('\nPASS: window rendered, IPC round trip ok, no console errors, no CSP violations')

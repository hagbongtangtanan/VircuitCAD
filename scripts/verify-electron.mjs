// Smoke-tests a running Electron build over the Chrome DevTools Protocol.
//
// Usage:
//   npm run dev -- --noSandbox --remoteDebuggingPort 9222   # or:
//   electron out/main/index.js --no-sandbox --remote-debugging-port=9223
//   CDP_HOST=http://127.0.0.1:9223 node scripts/verify-electron.mjs
//
// Asserts that the renderer mounted, the `window.api.ping` IPC round trip works,
// and that the window logged no console errors or CSP violations. Exits non-zero
// on failure so it can gate CI.

const CDP_HOST = process.env.CDP_HOST ?? 'http://127.0.0.1:9222'
const WAIT_MS = Number(process.env.CDP_WAIT_MS ?? 60000)

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

if (failures.length > 0) {
  console.error('\nFAIL:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('\nPASS: window rendered, IPC round trip ok, no console errors, no CSP violations')

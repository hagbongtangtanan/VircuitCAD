import { join } from 'node:path'
import { app } from 'electron'
import type { CompileResult, ToolchainStatus } from '../../shared/schemas'
import {
  MISSING_TOOLCHAIN_RESULT,
  MISSING_TOOLCHAIN_STATUS,
  compileWithToolchain,
  toolchainFromDir,
  toolchainStatusOf,
  type Toolchain,
} from './toolchain'

/**
 * Electron-facing wrapper around the vendored toolchain: it only contributes
 * the platform's install locations and serialises concurrent builds.
 */

/** Candidate roots, most specific first: packaged, then dev checkouts. */
function toolchainCandidates(): readonly string[] {
  const platformDir = process.platform === 'darwin' ? 'darwin' : process.platform
  return [
    join(process.resourcesPath, 'toolchain', platformDir),
    join(app.getAppPath(), 'resources', 'toolchain', platformDir),
    join(process.cwd(), 'resources', 'toolchain', platformDir),
  ]
}

function resolveToolchain(): Toolchain | null {
  for (const dir of toolchainCandidates()) {
    const toolchain = toolchainFromDir(dir)
    if (toolchain !== null) return toolchain
  }
  return null
}

/**
 * Compiles are serialised: a classroom machine should not start a second
 * compiler while the first one is still running.
 */
let queue: Promise<unknown> = Promise.resolve()

export function compileSketch(sketch: string): Promise<CompileResult> {
  const task = queue.then(async () => {
    const toolchain = resolveToolchain()
    if (toolchain === null) return MISSING_TOOLCHAIN_RESULT
    return compileWithToolchain(toolchain, sketch)
  })
  queue = task.catch(() => undefined)
  return task
}

export async function readToolchainStatus(): Promise<ToolchainStatus> {
  const toolchain = resolveToolchain()
  if (toolchain === null) return MISSING_TOOLCHAIN_STATUS
  return toolchainStatusOf(toolchain)
}

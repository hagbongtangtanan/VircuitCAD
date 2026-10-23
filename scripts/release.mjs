#!/usr/bin/env node
// Publishes the installers in `release/` to a GitHub Release.
//
// CI is the primary release path (`.github/workflows/release.yml`, triggered by
// a `v*` tag). This script is the manual/hotfix path and the dry-run tool: it
// needs no dependencies beyond Node, preferring the `gh` CLI's authenticated
// session and falling back to the GitHub REST API with GITHUB_TOKEN/GH_TOKEN.
//
//   node scripts/release.mjs [--dry-run] [--draft] [--prerelease]
//                            [--notes-file <path>] [--dir <path>] [--allow-dirty]

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { openAsBlob } from 'node:fs'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const OWNER = 'hagbongtangtanan'
const REPO = 'VircuitCAD'
const SLUG = `${OWNER}/${REPO}`
const RELEASES_URL = `https://github.com/${SLUG}/releases`
const UPLOADS_HOST = 'https://uploads.github.com'

// Everything electron-builder writes for the targets in electron-builder.yml,
// plus the updater metadata (`latest*.yml`) and block maps that clients fetch.
const INSTALLER_EXTENSIONS = [
  '.AppImage',
  '.tar.gz',
  '.blockmap',
  '.dmg',
  '.exe',
  '.msi',
  '.deb',
  '.rpm',
  '.snap',
  '.zip',
]
const UPDATE_INFO_PATTERN = /^latest.*\.ya?ml$/i
// Local build diagnostics; never useful to a downloader.
const NEVER_PUBLISH = new Set(['builder-debug.yml', 'builder-effective-config.yaml'])
const CHECKSUM_FILE = 'SHA256SUMS.txt'

const log = {
  step: (message) => console.log(`\n==> ${message}`),
  info: (message) => console.log(`    ${message}`),
  warn: (message) => console.warn(`    warning: ${message}`),
  error: (message) => console.error(`error: ${message}`),
}

/** Runs a command and throws a readable error when it exits non-zero. */
async function run(command, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      maxBuffer: 16 * 1024 * 1024,
    })
    return { stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim()
    throw new Error(`${command} ${args.join(' ')} failed: ${detail}`, { cause: error })
  }
}

/** Same as run(), but failure is data instead of an exception. */
async function tryRun(command, args, options = {}) {
  try {
    return { ok: true, ...(await run(command, args, options)) }
  } catch (error) {
    return { ok: false, stdout: '', stderr: error.message }
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    draft: false,
    prerelease: false,
    notesFile: null,
    dir: 'release',
    allowDirty: false,
    help: false,
  }
  const takeValue = (flag, index) => {
    const equals = argv[index].indexOf('=')
    if (equals !== -1) return { value: argv[index].slice(equals + 1), index }
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${flag} needs a value`)
    }
    return { value, index: index + 1 }
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--draft') {
      options.draft = true
    } else if (arg === '--prerelease') {
      options.prerelease = true
    } else if (arg === '--allow-dirty') {
      options.allowDirty = true
    } else if (arg === '--notes-file' || arg.startsWith('--notes-file=')) {
      const taken = takeValue('--notes-file', index)
      options.notesFile = taken.value
      index = taken.index
    } else if (arg === '--dir' || arg.startsWith('--dir=')) {
      const taken = takeValue('--dir', index)
      options.dir = taken.value
      index = taken.index
    } else {
      throw new Error(`unknown option: ${arg} (try --help)`)
    }
  }
  return options
}

function printHelp() {
  console.log(`Publish the artifacts in release/ to a GitHub Release.

Usage: node scripts/release.mjs [options]

Options:
  --dry-run            Show the plan (tag, assets, notes) without writing anything
  --draft              Create the release as a draft instead of publishing it
  --prerelease         Mark the release as a pre-release (implied by a -suffix version)
  --notes-file <path>  Use this Markdown file instead of generated release notes
  --dir <path>         Directory holding the build artifacts (default: release)
  --allow-dirty        Publish even when the git working tree is not clean

Environment:
  GH_TOKEN / GITHUB_TOKEN   GitHub token used for the REST fallback (gh reuses the
                            same variables). When neither is set, an authenticated
                            \`gh\` session is required.
`)
}

async function readVersion() {
  const manifest = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'))
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    throw new Error('package.json has no version')
  }
  return manifest.version
}

/** The tag must be `v<version>`, and origin must be the repository we publish to. */
async function verifyRepository() {
  const remote = await run('git', ['remote', 'get-url', 'origin'])
  const match = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(remote.stdout)
  if (match === null || `${match[1]}/${match[2]}`.toLowerCase() !== SLUG.toLowerCase()) {
    throw new Error(
      `origin points at ${remote.stdout || '(nothing)'}, expected ${SLUG}.\n` +
        'Refusing to publish to an unexpected repository.'
    )
  }
}

async function verifyCleanTree(allowDirty, dryRun) {
  const status = await run('git', ['status', '--porcelain'])
  if (status.stdout.length === 0) return
  const summary = status.stdout.split('\n')[0]
  if (allowDirty) {
    log.warn(`working tree is dirty (${summary}); continuing because of --allow-dirty`)
  } else if (dryRun) {
    log.warn(`working tree is dirty (${summary}); a real run would refuse without --allow-dirty`)
  } else {
    throw new Error(
      `working tree is dirty (${summary}); commit or stash first, or pass --allow-dirty`
    )
  }
}

async function commandExists(command) {
  return (await tryRun(command, ['--version'])).ok
}

async function resolveAuth() {
  const hasGh = await commandExists('gh')
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? null
  const ghAuthenticated = hasGh && (await tryRun('gh', ['auth', 'status'])).ok
  // gh reads GH_TOKEN/GITHUB_TOKEN from the environment itself, so a token is
  // enough even when the CLI has no stored session.
  if (hasGh && (ghAuthenticated || token !== null)) {
    return { useGh: true, token, description: 'gh CLI' }
  }
  if (token !== null) return { useGh: false, token, description: 'GitHub REST API (token)' }
  return { useGh: false, token: null, description: 'none' }
}

function isPublishable(name) {
  return (
    !NEVER_PUBLISH.has(name) &&
    (INSTALLER_EXTENSIONS.some((extension) => name.endsWith(extension)) ||
      UPDATE_INFO_PATTERN.test(name))
  )
}

/** Artifacts live directly in the output directory; `*-unpacked/` is skipped. */
async function discoverAssets(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    throw new Error(`cannot read artifact directory ${dir}: ${error.message}`, { cause: error })
  }
  const assets = []
  for (const entry of entries) {
    if (!entry.isFile() || !isPublishable(entry.name)) continue
    const path = join(dir, entry.name)
    assets.push({ name: entry.name, path, size: (await stat(path)).size })
  }
  assets.sort((left, right) => left.name.localeCompare(right.name))
  if (assets.length === 0) {
    throw new Error(`no publishable artifacts in ${dir} (build the installers first)`)
  }
  return assets
}

/** Block maps and metadata are not installers, so they stay out of the sums. */
function isInstaller(name) {
  return (
    INSTALLER_EXTENSIONS.some((extension) => name.endsWith(extension)) &&
    !name.endsWith('.blockmap')
  )
}

async function sha256(path) {
  const hash = createHash('sha256')
  const blob = await openAsBlob(path)
  for await (const chunk of blob.stream()) hash.update(chunk)
  return hash.digest('hex')
}

async function buildChecksumFile(installers) {
  const lines = []
  for (const asset of installers) {
    lines.push(`${await sha256(asset.path)}  ${asset.name}`)
  }
  return `${lines.join('\n')}\n`
}

async function previousTag(currentTag) {
  const tags = (await run('git', ['tag', '--sort=-v:refname'])).stdout.split('\n').filter(Boolean)
  return tags.find((tag) => tag !== currentTag && /^v\d/.test(tag)) ?? null
}

async function recentCommits(from) {
  const range = from === null ? ['-n', '20'] : [`${from}..HEAD`]
  const { stdout } = await run('git', ['log', '--no-merges', '--pretty=format:%s', ...range])
  return stdout.split('\n').filter(Boolean)
}

function renderNotes({ version, commits, installers, hasChecksums }) {
  const named = (extensions) =>
    installers.filter((asset) => extensions.some((ext) => asset.name.endsWith(ext)))
  const appImages = named(['.AppImage'])
  const debs = named(['.deb'])
  const windows = named(['.exe', '.msi'])
  const macs = named(['.dmg'])
  const lines = [
    `# VircuitCAD v${version}`,
    '',
    'Offline, local Tinkercad Circuits-style Arduino simulator. No account, no network.',
    '',
    "## What's New",
    '',
    ...(commits.length > 0 ? commits.map((subject) => `- ${subject}`) : ['- Maintenance release.']),
  ]

  if (appImages.length > 0 || debs.length > 0 || windows.length > 0 || macs.length > 0) {
    lines.push('', '## Download & Install', '')
  }

  for (const asset of appImages) {
    const link = `${RELEASES_URL}/download/v${version}/${encodeURIComponent(asset.name)}`
    const extractAndRun = `./${asset.name} --appimage-extract-and-run`
    lines.push(
      '### Linux (AppImage)',
      '',
      `Download [\`${asset.name}\`](${link}), then:`,
      '',
      '```bash',
      `chmod +x ${asset.name}`,
      `./${asset.name}`,
      '```',
      '',
      'AppImages need FUSE 2 (`sudo apt install libfuse2` on Ubuntu 22.04+). Where FUSE is',
      `unavailable, run it with \`${extractAndRun}\` instead.`,
      ''
    )
  }

  for (const asset of debs) {
    const link = `${RELEASES_URL}/download/v${version}/${encodeURIComponent(asset.name)}`
    lines.push(
      '### Linux (Debian/Ubuntu)',
      '',
      `Download [\`${asset.name}\`](${link}), then:`,
      '',
      '```bash',
      `sudo dpkg -i ${asset.name}`,
      '```',
      ''
    )
  }

  for (const asset of windows) {
    lines.push(
      '### Windows',
      '',
      `Run \`${asset.name}\`. The build is not code-signed, so SmartScreen may warn once:`,
      '**More info → Run anyway**.',
      ''
    )
  }

  for (const asset of macs) {
    lines.push(
      '### macOS',
      '',
      `Open \`${asset.name}\` and drag **VircuitCAD** into Applications. The build is not`,
      'notarized, so on first launch use **right-click → Open** (or System Settings →',
      'Privacy & Security → **Open Anyway**).',
      ''
    )
  }

  if (hasChecksums) {
    lines.push(
      '## Checksums',
      '',
      `\`${CHECKSUM_FILE}\` lists the SHA-256 digest of every installer. Verify it next to your`,
      'downloads with `sha256sum -c SHA256SUMS.txt` (macOS: `shasum -a 256 -c SHA256SUMS.txt`).',
      ''
    )
  }

  return lines.join('\n')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

/**
 * Thin wrapper over the two transports. Both expose the same four operations so
 * the release flow below never branches on which one is in use.
 */
function createGitHubClient({ useGh, token, dryRun }) {
  const apiHeaders = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vircuitcad-release-script',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
  }

  async function request(method, path, body) {
    const response = await fetch(`https://api.github.com/repos/${SLUG}${path}`, {
      method,
      headers: apiHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.status === 404) return null
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, ' ').trim()
      throw new Error(`GitHub API ${method} ${path}: ${response.status} ${detail}`)
    }
    return response.status === 204 ? null : response.json()
  }

  async function ghApi(args) {
    const result = await tryRun('gh', ['api', ...args])
    if (result.ok) return JSON.parse(result.stdout)
    if (/\b404\b|not found/i.test(result.stderr)) return null
    throw new Error(result.stderr)
  }

  /**
   * Draft releases are absent from `/releases/tags/{tag}`, so the tag lookup
   * would miss a draft left by an earlier run and try to create it twice.
   * Listing and matching by tag name is what electron-builder's publisher does.
   */
  async function getRelease(tag) {
    const releases = useGh
      ? await ghApi([`repos/${SLUG}/releases?per_page=100`])
      : await request('GET', '/releases?per_page=100')
    if (releases === null) {
      throw new Error(
        `cannot list releases for ${SLUG}: the repository was not found, or the token has no access`
      )
    }
    return releases.find((release) => release.tag_name === tag) ?? null
  }

  async function createRelease(release) {
    if (dryRun) return null
    if (useGh) {
      return ghApi([
        '--method',
        'POST',
        `repos/${SLUG}/releases`,
        '-f',
        `tag_name=${release.tag}`,
        '-f',
        `target_commitish=${release.targetCommitish}`,
        '-f',
        `name=${release.name}`,
        '-f',
        `body=${release.body}`,
        '-F',
        `draft=${release.draft}`,
        '-F',
        `prerelease=${release.prerelease}`,
      ])
    }
    return request('POST', '/releases', {
      tag_name: release.tag,
      target_commitish: release.targetCommitish,
      name: release.name,
      body: release.body,
      draft: release.draft,
      prerelease: release.prerelease,
    })
  }

  async function updateRelease(id, release) {
    if (dryRun) return null
    if (useGh) {
      return ghApi([
        '--method',
        'PATCH',
        `repos/${SLUG}/releases/${id}`,
        '-f',
        `name=${release.name}`,
        '-f',
        `body=${release.body}`,
        '-F',
        `draft=${release.draft}`,
        '-F',
        `prerelease=${release.prerelease}`,
      ])
    }
    return request('PATCH', `/releases/${id}`, {
      name: release.name,
      body: release.body,
      draft: release.draft,
      prerelease: release.prerelease,
    })
  }

  /** Existing assets are replaced, so re-running a release is safe. */
  async function uploadAssets(release, files) {
    if (dryRun) return
    if (useGh) {
      await run('gh', [
        'release',
        'upload',
        release.tag_name,
        ...files,
        '--clobber',
        '--repo',
        SLUG,
      ])
      return
    }
    for (const file of files) {
      const name = basename(file)
      const existing = (release.assets ?? []).find((asset) => asset.name === name)
      if (existing !== undefined) {
        await request('DELETE', `/releases/assets/${existing.id}`)
      }
      const blob = await openAsBlob(file)
      const response = await fetch(
        `${UPLOADS_HOST}/repos/${SLUG}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
        {
          method: 'POST',
          headers: {
            ...apiHeaders,
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(blob.size),
          },
          body: blob,
        }
      )
      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, ' ').trim()
        throw new Error(`uploading ${name}: ${response.status} ${detail}`)
      }
      log.info(`uploaded ${name}`)
    }
  }

  return { getRelease, createRelease, updateRelease, uploadAssets }
}

async function tagExists(tag) {
  const local = await tryRun('git', ['rev-parse', '--quiet', '--verify', `refs/tags/${tag}`])
  if (local.ok) return { local: true, remote: true }
  const remote = await tryRun('git', [
    'ls-remote',
    '--exit-code',
    '--tags',
    'origin',
    `refs/tags/${tag}`,
  ])
  return { local: false, remote: remote.ok && remote.stdout.length > 0 }
}

async function ensureTag({ tag, version, dryRun }) {
  const { local, remote } = await tagExists(tag)
  if (local && remote) return
  log.step(`Tag ${tag} is missing (${local ? 'only local' : 'not created yet'})`)
  if (dryRun) {
    log.info(`would create: git tag -a ${tag} -m "VircuitCAD ${tag}"`)
    log.info(`would push:   git push origin refs/tags/${tag}`)
    return
  }
  if (!local) {
    await run('git', ['tag', '-a', tag, '-m', `VircuitCAD ${version}`])
    log.info(`created tag ${tag}`)
  }
  await run('git', ['push', 'origin', `refs/tags/${tag}`])
  log.info(`pushed tag ${tag}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const version = await readVersion()
  const tag = `v${version}`
  const artifactsDir = resolve(repoRoot, options.dir)
  const isSemverPrerelease = version.includes('-')
  const prerelease = options.prerelease || isSemverPrerelease
  const draft = options.draft

  log.step(`Releasing VircuitCAD ${version}${options.dryRun ? ' (dry run)' : ''}`)
  log.info(`repository: ${SLUG}`)
  log.info(`tag:        ${tag}`)
  log.info(`directory:  ${artifactsDir}`)
  log.info(`release:    ${draft ? 'draft' : prerelease ? 'pre-release' : 'published'}`)

  await verifyRepository()
  await verifyCleanTree(options.allowDirty, options.dryRun)

  const auth = await resolveAuth()
  if (auth.token === null && !auth.useGh) {
    if (!options.dryRun) {
      throw new Error(
        'not authenticated: install and log in to `gh`, or export GH_TOKEN / GITHUB_TOKEN'
      )
    }
    log.warn('no GitHub authentication found; a real run would stop here')
  } else {
    log.info(`auth:       ${auth.description}`)
  }

  const assets = await discoverAssets(artifactsDir)
  const installers = assets.filter((asset) => isInstaller(asset.name))
  log.step(
    `Assets (${assets.length} files, ${formatBytes(assets.reduce((sum, a) => sum + a.size, 0))})`
  )
  for (const asset of assets) log.info(`${formatBytes(asset.size).padStart(10)}  ${asset.name}`)
  const spaced = assets.find((asset) => asset.name.includes(' '))
  if (spaced !== undefined) {
    log.warn(
      `asset names contain spaces (${spaced.name}); GitHub rewrites those, so the URLs in ` +
        `latest-*.yml and the notes will not match. Rebuild with the current artifactName.`
    )
  }

  let notes
  if (options.notesFile !== null) {
    notes = await readFile(resolve(options.notesFile), 'utf8')
    log.info(`notes:      ${options.notesFile}`)
  } else {
    const from = await previousTag(tag)
    const commits = await recentCommits(from)
    const since = from === null ? 'no previous tag' : `since ${from}`
    log.info(`notes:      ${commits.length} commit(s), ${since}`)
    notes = renderNotes({
      version,
      commits,
      installers,
      hasChecksums: installers.length > 0,
    })
  }

  if (installers.length > 0) {
    const checksums = await buildChecksumFile(installers)
    const checksumPath = join(artifactsDir, CHECKSUM_FILE)
    if (options.dryRun) {
      const entries = installers.length === 1 ? 'entry' : 'entries'
      log.info(`would write ${CHECKSUM_FILE} (${installers.length} ${entries})`)
    } else {
      await writeFile(checksumPath, checksums)
      log.info(`wrote ${CHECKSUM_FILE}`)
    }
    assets.push({ name: CHECKSUM_FILE, path: checksumPath, size: Buffer.byteLength(checksums) })
  }

  const client = createGitHubClient({
    useGh: auth.useGh,
    token: auth.token,
    dryRun: options.dryRun,
  })
  // Reading the release first proves the credentials against the API; creating
  // and pushing the tag is a write and must not happen before that.
  const existing = auth.useGh || auth.token !== null ? await client.getRelease(tag) : null

  await ensureTag({ tag, version, dryRun: options.dryRun })

  const releaseShape = {
    tag,
    targetCommitish: (await run('git', ['rev-parse', 'HEAD'])).stdout,
    name: `VircuitCAD ${tag}`,
    body: notes,
    draft,
    prerelease,
  }

  let release
  if (existing === null) {
    log.step(`Creating release ${tag}`)
    release = (await client.createRelease(releaseShape)) ?? {
      ...releaseShape,
      tag_name: tag,
      assets: [],
    }
  } else {
    log.step(`Updating existing release ${tag}`)
    release = (await client.updateRelease(existing.id, releaseShape)) ?? existing
  }
  if (options.dryRun) {
    log.info(`would create or update the release at ${RELEASES_URL}/tag/${tag}`)
  }

  if (draft) log.info('release stays a draft until it is published on GitHub')

  log.step(`Uploading ${assets.length} assets`)
  await client.uploadAssets(
    { ...release, tag_name: tag, assets: existing?.assets ?? [] },
    assets.map((asset) => asset.path)
  )

  if (options.dryRun) {
    console.log(`\nDry run complete; nothing was written to GitHub.`)
    console.log(`\nRelease notes that would be used:\n\n${notes}`)
    return
  }

  console.log(`\nReleased VircuitCAD ${version}`)
  console.log(`  ${RELEASES_URL}/tag/${tag}`)
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

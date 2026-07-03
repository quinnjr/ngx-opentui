import { afterAll, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createTestRenderer } from '@opentui/core/testing'
import { runAotCli } from '../../src/aot/cli'

const entryPath = import.meta.dir + '/fixtures/task-app-entry.ts'
const tsconfigPath = import.meta.dir + '/fixtures/tsconfig.cli-entry.json'

// Build outputs land under the repo root (gitignored via `.tmp-aot-*/`)
// rather than the OS tmpdir: the built entry re-imports @opentui/core as an
// external at run time, and Bun's module resolution walks up from the file's
// own directory to find node_modules. A path outside the repo (e.g. system
// /tmp) never reaches the project's node_modules, so the dynamic import
// below would fail to resolve @opentui/core.
const scratchRoot = import.meta.dir + '/../../.tmp-aot-cli-test'

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true })
})

test('builds the entry and the output bootstraps + renders through the real path', async () => {
  await mkdir(scratchRoot, { recursive: true })
  const outdir = await mkdtemp(join(scratchRoot, 'build-'))
  try {
    await runAotCli([entryPath, '--outdir', outdir, '--tsconfig', tsconfigPath])

    const { bootstrapCliFixture } = await import(join(outdir, 'task-app-entry.js'))

    const setup = await createTestRenderer({ width: 30, height: 8 })
    const app = await bootstrapCliFixture(setup.renderer)
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    expect(frame).toContain('cli-fixture: ok')

    app.destroy()
  } finally {
    await rm(outdir, { recursive: true, force: true })
  }
})

test('rejects when no entry argument is given', async () => {
  await expect(runAotCli([])).rejects.toThrow(/entry/)
})

test('rejects when --outdir is given no value', async () => {
  await expect(runAotCli([entryPath, '--outdir'])).rejects.toThrow(/--outdir/)
})

test('defaults outdir to "dist" when --outdir is not passed', async () => {
  await mkdir(scratchRoot, { recursive: true })
  const cwd = await mkdtemp(join(scratchRoot, 'cwd-'))
  const originalCwd = process.cwd()
  process.chdir(cwd)
  try {
    const result = await runAotCli([entryPath, '--tsconfig', tsconfigPath])
    expect(result.outdir).toBe('dist')

    const distFile = Bun.file(join(cwd, 'dist', 'task-app-entry.js'))
    expect(await distFile.exists()).toBe(true)
  } finally {
    process.chdir(originalCwd)
    await rm(cwd, { recursive: true, force: true })
  }
})

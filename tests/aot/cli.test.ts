import { afterAll, expect, spyOn, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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

test('rejects when --tsconfig is given no value', async () => {
  await expect(runAotCli([entryPath, '--tsconfig'])).rejects.toThrow(/--tsconfig/)
})

test('rejects when the build fails', async () => {
  await mkdir(scratchRoot, { recursive: true })
  const outdir = await mkdtemp(join(scratchRoot, 'build-fail-'))
  try {
    await expect(
      runAotCli([
        import.meta.dir + '/fixtures/bad.component.ts',
        '--outdir',
        outdir,
        '--tsconfig',
        import.meta.dir + '/fixtures/tsconfig.invalid.json',
      ]),
    ).rejects.toThrow(/build failed/)
  } finally {
    await rm(outdir, { recursive: true, force: true })
  }
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

test('compiles to a standalone executable with a default name derived from the entry', async () => {
  await mkdir(scratchRoot, { recursive: true })
  const outdir = await mkdtemp(join(scratchRoot, 'compile-default-'))
  try {
    const result = await runAotCli([entryPath, '--outdir', outdir, '--tsconfig', tsconfigPath, '--compile'])
    const expectedOutfile = join(outdir, 'task-app-entry')
    expect(result.outfile).toBe(expectedOutfile)

    const proc = Bun.spawn([expectedOutfile], { stdout: 'pipe', stderr: 'pipe' })
    const code = await proc.exited
    expect(code).toBe(0)
  } finally {
    await rm(outdir, { recursive: true, force: true })
  }
})

test('compiles to an explicit --outfile location, overriding the default name', async () => {
  await mkdir(scratchRoot, { recursive: true })
  const outdir = await mkdtemp(join(scratchRoot, 'compile-explicit-'))
  const explicitOutfile = join(outdir, 'my-custom-name')
  try {
    const result = await runAotCli([
      entryPath,
      '--outdir',
      outdir,
      '--tsconfig',
      tsconfigPath,
      '--compile',
      '--outfile',
      explicitOutfile,
    ])
    expect(result.outfile).toBe(explicitOutfile)
    expect(await Bun.file(explicitOutfile).exists()).toBe(true)
  } finally {
    await rm(outdir, { recursive: true, force: true })
  }
})

test('rejects when --outfile is given no value', async () => {
  await expect(runAotCli([entryPath, '--compile', '--outfile'])).rejects.toThrow(/--outfile/)
})

test('prints a reminder that @opentui/core must be resolvable at runtime after a --compile build', async () => {
  await mkdir(scratchRoot, { recursive: true })
  const outdir = await mkdtemp(join(scratchRoot, 'compile-reminder-'))
  const logSpy = spyOn(console, 'log')
  try {
    await runAotCli([entryPath, '--outdir', outdir, '--tsconfig', tsconfigPath, '--compile'])
    const messages = logSpy.mock.calls.map((call) => call.join(' '))
    expect(messages.some((message) => message.includes('@opentui/core'))).toBe(true)
  } finally {
    logSpy.mockRestore()
    await rm(outdir, { recursive: true, force: true })
  }
})

test('a --compile executable fails at runtime when @opentui/core is not resolvable from its cwd', async () => {
  await mkdir(scratchRoot, { recursive: true })
  const outdir = await mkdtemp(join(scratchRoot, 'compile-portability-'))
  // Deliberately outside the repo tree (unlike scratchRoot above) — the
  // compiled executable must fail to resolve @opentui/core here, proving
  // it isn't fully self-contained.
  const noNodeModulesCwd = await mkdtemp(join(tmpdir(), 'ngx-opentui-aot-no-node-modules-'))
  try {
    const result = await runAotCli([entryPath, '--outdir', outdir, '--tsconfig', tsconfigPath, '--compile'])

    const proc = Bun.spawn([result.outfile!], { cwd: noNodeModulesCwd, stdout: 'pipe', stderr: 'pipe' })
    const code = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(code).not.toBe(0)
    expect(stderr).toContain('@opentui/core')
  } finally {
    await rm(outdir, { recursive: true, force: true })
    await rm(noNodeModulesCwd, { recursive: true, force: true })
  }
})

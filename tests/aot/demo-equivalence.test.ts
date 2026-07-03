import { expect, test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import { bootstrapTuiApplication } from '../../src'
import { ngxOpenTuiAot } from '../../src/aot/plugin'
import { TaskApp } from '../../demo/app.component'

async function renderJit(): Promise<string> {
  const setup = await createTestRenderer({ width: 50, height: 12 })
  const app = await bootstrapTuiApplication(TaskApp, { renderer: setup.renderer })
  await setup.renderOnce()
  const frame = setup.captureCharFrame()
  app.destroy()
  return frame
}

async function renderAot(): Promise<string> {
  const result = await Bun.build({
    entrypoints: [import.meta.dir + '/fixtures/task-app-headless-entry.ts'],
    outdir: import.meta.dir + '/../../.tmp-aot-demo-equivalence',
    plugins: [ngxOpenTuiAot({ tsconfig: import.meta.dir + '/fixtures/tsconfig.demo-equivalence.json' })],
    external: ['@opentui/core'],
    throw: false,
  })
  expect(result.success).toBe(true)

  const { bootstrapTaskAppHeadless } = await import(result.outputs[0]!.path)
  const setup = await createTestRenderer({ width: 50, height: 12 })
  const app = await bootstrapTaskAppHeadless(setup.renderer)
  await setup.renderOnce()
  const frame = setup.captureCharFrame()
  app.destroy()
  return frame
}

test('AOT-compiled TaskApp renders identically to the JIT-bootstrapped one', async () => {
  const [jitFrame, aotFrame] = await Promise.all([renderJit(), renderAot()])
  expect(aotFrame).toBe(jitFrame)
})

import { expect, test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import { ngxOpenTuiAot } from '../../src/aot/plugin'
import { bootstrapTuiApplication } from '../../src'

test('bootstrapTuiApplication works unmodified against an AOT-compiled component', async () => {
  const result = await Bun.build({
    entrypoints: [import.meta.dir + '/fixtures/greeting.component.ts'],
    outdir: import.meta.dir + '/../../.tmp-aot-bootstrap-compat',
    plugins: [ngxOpenTuiAot({ tsconfig: import.meta.dir + '/fixtures/tsconfig.valid.json' })],
    external: ['@angular/core'],
    throw: false,
  })
  expect(result.success).toBe(true)

  const { GreetingFixture } = await import(result.outputs[0]!.path)

  const setup = await createTestRenderer({ width: 30, height: 8 })
  const app = await bootstrapTuiApplication(GreetingFixture, { renderer: setup.renderer })
  await setup.renderOnce()

  const frame = setup.captureCharFrame()
  expect(frame).toContain('hello, world')

  app.destroy()
})

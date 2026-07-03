import { expect, test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import { ngxOpenTuiAot } from '../../src/aot/plugin'
import { bootstrapTuiApplication } from '../../src'

test('bootstrapTuiApplication works unmodified against an AOT-compiled component', async () => {
  const result = await Bun.build({
    entrypoints: [import.meta.dir + '/fixtures/greeting.component.ts'],
    outdir: import.meta.dir + '/../../.tmp-aot-bootstrap-compat',
    plugins: [ngxOpenTuiAot({ tsconfig: import.meta.dir + '/fixtures/tsconfig.valid.json' })],
    // Without this, Bun.build bundles a second copy of @angular/core into the
    // compiled component output. That copy has its own DI globals, separate
    // from the one bootstrapTuiApplication runs against, so inject()/
    // EnvironmentInjector resolution breaks with NG0203. Any build pipeline
    // that calls Bun.build() on AOT output (e.g. a future CLI builder) needs
    // the same external entry.
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

import { expect, test } from 'bun:test'
import { ngxOpenTuiAot } from '../../src/aot/plugin'

test('compiles a valid fixture into a component with a stamped ɵcmp', async () => {
  const result = await Bun.build({
    entrypoints: [import.meta.dir + '/fixtures/greeting.component.ts'],
    outdir: '/tmp/ngx-opentui-aot-test-valid',
    plugins: [ngxOpenTuiAot({ tsconfig: import.meta.dir + '/fixtures/tsconfig.valid.json' })],
    throw: false,
  })
  expect(result.success).toBe(true)
  const output = await result.outputs[0]!.text()
  expect(output).toContain('ɵcmp')
  expect(output).not.toContain('node_modules/@angular/compiler/')
})

test('surfaces ngtsc diagnostics as a build error for an invalid fixture', async () => {
  const result = await Bun.build({
    entrypoints: [import.meta.dir + '/fixtures/bad.component.ts'],
    outdir: '/tmp/ngx-opentui-aot-test-invalid',
    plugins: [ngxOpenTuiAot({ tsconfig: import.meta.dir + '/fixtures/tsconfig.invalid.json' })],
    throw: false,
  })
  expect(result.success).toBe(false)
  expect(result.logs.some((log) => log.message.includes('missingProperty'))).toBe(true)
})

test('passes through non-Angular .ts files untouched', async () => {
  const result = await Bun.build({
    entrypoints: [import.meta.dir + '/fixtures/plain-util.ts'],
    outdir: '/tmp/ngx-opentui-aot-test-passthrough',
    plugins: [ngxOpenTuiAot({ tsconfig: import.meta.dir + '/fixtures/tsconfig.valid.json' })],
    throw: false,
  })
  expect(result.success).toBe(true)
  const { double } = await import(result.outputs[0]!.path)
  expect(double(21)).toBe(42)
})

test('surfaces an unreadable tsconfig path as a build error instead of crashing', async () => {
  const result = await Bun.build({
    entrypoints: [import.meta.dir + '/fixtures/greeting.component.ts'],
    outdir: '/tmp/ngx-opentui-aot-test-bad-tsconfig',
    plugins: [ngxOpenTuiAot({ tsconfig: '/nonexistent/path/tsconfig.json' })],
    throw: false,
  })
  expect(result.success).toBe(false)
  expect(result.logs.some((log) => /tsconfig|ENOENT|not exist/i.test(log.message))).toBe(true)
})

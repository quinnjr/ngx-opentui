import { expect, test } from 'bun:test'
import { BoxRenderable } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

test('opentui test renderer boots headlessly', async () => {
  const setup = await createTestRenderer({ width: 20, height: 5 })
  setup.renderer.root.add(new BoxRenderable(setup.renderer, { width: 10, height: 3, border: true }))
  await setup.renderOnce()
  expect(setup.captureCharFrame().length).toBeGreaterThan(0)
  setup.renderer.destroy()
})

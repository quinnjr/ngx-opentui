import { expect, test } from 'bun:test'
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core'
import { createTestRenderer } from '@opentui/core/testing'
import { bootstrapTuiApplication, TuiKeyboard } from '../src'

@Component({
  selector: 'counter-app',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <box padding="1" flexDirection="column">
      <text>count: {{ count() }}</text>
      @if (count() > 0) {
        <text>positive</text>
      }
    </box>
  `,
})
class CounterApp {
  readonly count = signal(0)

  constructor() {
    inject(TuiKeyboard).onKey((key) => {
      if (key.name === 'up') this.count.update((c) => c + 1)
    })
  }
}

test('bootstraps, renders, and re-renders on key-driven signal update', async () => {
  const setup = await createTestRenderer({ width: 30, height: 8 })
  const app = await bootstrapTuiApplication(CounterApp, { renderer: setup.renderer })
  await setup.renderOnce()

  const first = setup.captureCharFrame()
  expect(first).toContain('count: 0')
  expect(first).not.toContain('positive')

  setup.mockInput.pressArrow('up')
  const updated = await setup.waitForFrame((f) => f.includes('count: 1'))
  expect(updated).toContain('positive')

  app.destroy()
})

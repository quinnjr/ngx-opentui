import { expect, test } from 'bun:test'
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import type { InputRenderable } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { bootstrapTuiApplication, TuiFocus } from '../src'

@Component({
  selector: 'multi-input-app',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <box flexDirection="column">
      <input placeholder="first" />
      <box><input placeholder="second" /></box>
      <input placeholder="third" />
    </box>
  `,
})
class MultiInputApp {}

async function launch() {
  const setup = await createTestRenderer({ width: 40, height: 8 })
  const app = await bootstrapTuiApplication(MultiInputApp, { renderer: setup.renderer })
  await setup.renderOnce()
  const focus = app.appRef.injector.get(TuiFocus)
  const inputs = focus.focusables() as InputRenderable[]
  return { setup, app, focus, inputs }
}

test('focusables are collected in tree order', async () => {
  const { app, focus, inputs } = await launch()
  expect(inputs.map((i) => i.placeholder)).toEqual(['first', 'second', 'third'])
  expect(focus.current()).toBeNull()
  app.destroy()
})

test('focusNext/focusPrevious cycle with wrap-around', async () => {
  const { app, focus, inputs } = await launch()
  focus.focusNext()
  expect(inputs[0]!.focused).toBe(true)
  focus.focusNext()
  focus.focusNext()
  expect(inputs[2]!.focused).toBe(true)
  focus.focusNext()
  expect(inputs[0]!.focused).toBe(true)
  focus.focusPrevious()
  expect(inputs[2]!.focused).toBe(true)
  app.destroy()
})

test('enableTabCycling binds tab / shift+tab and teardown unbinds', async () => {
  const { setup, app, focus, inputs } = await launch()
  const teardown = focus.enableTabCycling()
  setup.mockInput.pressTab()
  await setup.flush()
  expect(inputs[0]!.focused).toBe(true)
  setup.mockInput.pressTab()
  await setup.flush()
  expect(inputs[1]!.focused).toBe(true)
  setup.mockInput.pressTab({ shift: true })
  await setup.flush()
  expect(inputs[0]!.focused).toBe(true)
  teardown()
  setup.mockInput.pressTab()
  await setup.flush()
  expect(inputs[0]!.focused).toBe(true)
  app.destroy()
})

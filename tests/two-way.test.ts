import { expect, test } from 'bun:test'
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core'
import type { InputRenderable } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { bootstrapTuiApplication } from '../src'

@Component({
  selector: 'form-app',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <box flexDirection="column">
      <input [(value)]="text" #inp />
      <text>typed: {{ text() }}</text>
    </box>
  `,
})
class FormApp {
  readonly text = signal('')
}

test('[(value)] flows typing into the signal and signal writes into the input', async () => {
  const setup = await createTestRenderer({ width: 40, height: 6 })
  const app = await bootstrapTuiApplication(FormApp, { renderer: setup.renderer })
  await setup.renderOnce()

  const input = setup.renderer.root.findDescendantById(
    setup.renderer.root.getChildren()[0]!.getChildren()[0]!.id,
  ) as InputRenderable
  input.focus()

  await setup.mockInput.typeText('hola')
  await setup.waitForFrame((f) => f.includes('typed: hola'))
  expect(app.componentRef.instance.text()).toBe('hola')

  app.componentRef.instance.text.set('reset')
  await setup.waitForFrame((f) => f.includes('typed: reset'))
  expect(input.value).toBe('reset')

  app.destroy()
})

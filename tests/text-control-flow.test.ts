import { expect, test } from 'bun:test'
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core'
import { createTestRenderer } from '@opentui/core/testing'
import { bootstrapTuiApplication } from '../src'

@Component({
  selector: 'styled-text-app',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <box flexDirection="column">
      <text>tags:@for (tag of tags(); track $index) { {{ tag }}}@if (hot()) { [HOT]}</text>
    </box>
  `,
})
class StyledTextApp {
  readonly tags = signal(['alpha', 'beta'])
  readonly hot = signal(false)
}

test('@for and @if work inside <text>', async () => {
  const setup = await createTestRenderer({ width: 50, height: 5 })
  const app = await bootstrapTuiApplication(StyledTextApp, { renderer: setup.renderer })
  await setup.renderOnce()

  expect(setup.captureCharFrame()).toContain('tags: alpha beta')

  app.componentRef.instance.tags.update((tags) => [...tags, 'gamma'])
  await setup.waitForFrame((f) => f.includes('tags: alpha beta gamma'))

  app.componentRef.instance.hot.set(true)
  await setup.waitForFrame((f) => f.includes('tags: alpha beta gamma [HOT]'))

  app.componentRef.instance.tags.set([])
  app.componentRef.instance.hot.set(false)
  await setup.waitForFrame((f) => {
    const line = f.split('\n').find((l) => l.includes('tags:'))
    return line !== undefined && line.replaceAll(' ', '').endsWith('tags:'.replaceAll(' ', ''))
  })

  app.destroy()
})

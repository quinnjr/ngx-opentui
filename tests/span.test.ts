import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core'
import { TextNodeRenderable, type TextRenderable } from '@opentui/core'
import { createTestRenderer, type TestRendererSetup } from '@opentui/core/testing'
import { bootstrapTuiApplication } from '../src'
import { TuiRenderer } from '../src/renderer'

let setup: TestRendererSetup
let r: TuiRenderer

beforeAll(async () => {
  setup = await createTestRenderer({ width: 50, height: 6 })
  r = new TuiRenderer(setup.renderer)
})
afterAll(() => setup.renderer.destroy())

test('<span> creates a text node styleable via properties', () => {
  const span = r.createElement('span')
  expect(span).toBeInstanceOf(TextNodeRenderable)
  r.setProperty(span, 'fg', '#ff0000')
  expect((span as TextNodeRenderable).fg).toBeDefined()
})

test('spans nest inside <text> and other spans', () => {
  const text = r.createElement('text') as TextRenderable
  const outer = r.createElement('span')
  const inner = r.createElement('span')
  r.appendChild(text, outer)
  r.appendChild(outer, inner)
  r.appendChild(inner, r.createText('deep'))
  expect(text.textNode.toChunks().map((c) => c.text).join('')).toBe('deep')
})

test('<span> outside <text> still throws', () => {
  const box = r.createElement('box')
  expect(() => r.appendChild(box, r.createElement('span'))).toThrow(/must live inside <text>/)
})

test('<box> inside <text> names the <span> alternative', () => {
  const text = r.createElement('text')
  expect(() => r.appendChild(text, r.createElement('box'))).toThrow(/<span>/)
})

@Component({
  selector: 'status-app',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <box>
      <text>status: @if (err()) {<span fg="#ff0000">ERROR</span>} @else {<span fg="#00ff00">ok {{ n() }}</span>}</text>
    </box>
  `,
})
class StatusApp {
  readonly err = signal(false)
  readonly n = signal(1)
}

test('styled spans under @if/@else inside <text> render and swap', async () => {
  const s = await createTestRenderer({ width: 40, height: 4 })
  const app = await bootstrapTuiApplication(StatusApp, { renderer: s.renderer })
  await s.renderOnce()
  expect(s.captureCharFrame()).toContain('status: ok 1')

  app.componentRef.instance.n.set(7)
  await s.waitForFrame((f) => f.includes('status: ok 7'))

  app.componentRef.instance.err.set(true)
  await s.waitForFrame((f) => f.includes('status: ERROR'))

  app.destroy()
})

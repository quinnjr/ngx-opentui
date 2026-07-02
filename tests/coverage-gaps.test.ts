import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core'
import { BoxRenderable } from '@opentui/core'
import { createTestRenderer, type TestRendererSetup } from '@opentui/core/testing'
import { bootstrapTuiApplication } from '../src'
import { TuiRenderer } from '../src/renderer'

let setup: TestRendererSetup
let r: TuiRenderer

beforeAll(async () => {
  setup = await createTestRenderer({ width: 30, height: 6 })
  r = new TuiRenderer(setup.renderer)
})
afterAll(() => setup.renderer.destroy())

test('nextSibling walks attached siblings and returns null at the end', () => {
  const parent = r.createElement('box')
  const a = r.createElement('box')
  const b = r.createElement('box')
  r.appendChild(parent, a)
  r.appendChild(parent, b)
  expect(r.nextSibling(a)).toBe(b)
  expect(r.nextSibling(b)).toBeNull()
})

test('nextSibling of detached nodes and unmaterialized comments is null', () => {
  expect(r.nextSibling(r.createElement('box'))).toBeNull()
  expect(r.nextSibling(r.createComment('never attached'))).toBeNull()
})

test('parentNode of an unmaterialized comment is null', () => {
  expect(r.parentNode(r.createComment('never attached'))).toBeNull()
})

test('removeChild and destroyNode of an unmaterialized comment are no-ops', () => {
  const comment = r.createComment('never attached')
  r.removeChild(null, comment)
  r.destroyNode(comment)
  expect(comment.node).toBeNull()
})

test('removeChild falls back to the child parent when parent is null', () => {
  const parent = r.createElement('box')
  const child = r.createElement('box')
  r.appendChild(parent, child)
  r.removeChild(null, child)
  expect(parent.getChildren()).toHaveLength(0)
})

test('removeAttribute and removeStyle clear renderable properties', () => {
  const box = r.createElement('box') as BoxRenderable
  r.setAttribute(box, 'title', 'gone soon')
  r.removeAttribute(box, 'title')
  expect(box.title).toBeUndefined()
  r.setStyle(box, 'flexGrow', 2)
  r.removeStyle(box, 'flexGrow')
})

test('class ops and renderer destroy are no-ops', () => {
  const box = r.createElement('box')
  r.addClass(box, 'irrelevant')
  r.removeClass(box, 'irrelevant')
  r.destroy()
})

test('attribute coercion covers booleans, numbers, empty and plain strings', () => {
  const box = r.createElement('box') as BoxRenderable
  r.setAttribute(box, 'visible', 'true')
  expect(box.visible).toBe(true)
  r.setAttribute(box, 'flexGrow', '3')
  r.setAttribute(box, 'title', '')
  expect(box.title).toBe('')
  r.setAttribute(box, 'title', 'plain')
  expect(box.title).toBe('plain')
})

test('selectRootElement rejects selector strings', () => {
  expect(() => r.selectRootElement('app-root')).toThrow(/pass a renderable host/)
})

@Component({
  selector: 'crash-app',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<box><text>{{ risky() }}</text></box>`,
})
class CrashApp {
  readonly bomb = signal(false)
  risky(): string {
    if (this.bomb()) throw new Error('kaboom')
    return 'calm'
  }
}

test('TuiErrorHandler tears the renderer down and flags a failing exit', async () => {
  const s = await createTestRenderer({ width: 30, height: 4 })
  const app = await bootstrapTuiApplication(CrashApp, { renderer: s.renderer })
  await s.renderOnce()
  expect(s.captureCharFrame()).toContain('calm')

  const realConsoleError = console.error
  const reported: unknown[] = []
  console.error = (...args: unknown[]) => {
    reported.push(args)
  }
  try {
    app.componentRef.instance.bomb.set(true)
    // the scheduled zoneless tick throws, routing through TuiErrorHandler
    await new Promise((resolve) => setTimeout(resolve, 50))
  } finally {
    console.error = realConsoleError
  }

  expect(process.exitCode).toBe(1)
  process.exitCode = 0
  expect(reported.flat().some((e) => e instanceof Error && e.message.includes('kaboom'))).toBe(true)
  app.destroy()
})

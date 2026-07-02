import { afterAll, beforeAll, expect, test } from 'bun:test'
import { BoxRenderable, TextRenderable } from '@opentui/core'
import { createTestRenderer, type TestRendererSetup } from '@opentui/core/testing'
import { TuiRenderer } from '../src/renderer'

let setup: TestRendererSetup
let r: TuiRenderer

beforeAll(async () => {
  setup = await createTestRenderer({ width: 40, height: 10 })
  r = new TuiRenderer(setup.renderer)
})
afterAll(() => setup.renderer.destroy())

test('createElement maps known tags to renderables', () => {
  expect(r.createElement('box')).toBeInstanceOf(BoxRenderable)
  expect(r.createElement('text')).toBeInstanceOf(TextRenderable)
})

test('createElement throws on unknown tag, naming known tags', () => {
  expect(() => r.createElement('div')).toThrow(/unknown element <div>.*box/)
})

test('appendChild/insertBefore/removeChild maintain order', () => {
  const parent = r.createElement('box')
  const a = r.createElement('box')
  const b = r.createElement('box')
  const c = r.createElement('box')
  r.appendChild(parent, a)
  r.appendChild(parent, c)
  r.insertBefore(parent, b, c)
  expect(parent.getChildren()).toEqual([a, b, c])
  r.removeChild(parent, b)
  expect(parent.getChildren()).toEqual([a, c])
})

test('text nodes live under <text>; setValue replaces content', () => {
  const text = r.createElement('text') as TextRenderable
  const node = r.createText('hello')
  r.appendChild(text, node)
  r.setValue(node, 'world')
  // chunks flush on render passes; the text-node tree is the unit-test truth
  expect(text.textNode.toChunks().map((c) => c.text).join('')).toBe('world')
})

test('text node under <box> throws', () => {
  const box = r.createElement('box')
  expect(() => r.appendChild(box, r.createText('nope'))).toThrow(/must live inside <text>/)
})

test('renderable child under <text> throws', () => {
  const text = r.createElement('text')
  expect(() => r.appendChild(text, r.createElement('box'))).toThrow(/only text/)
})

test('comments are invisible zero-size anchors', () => {
  const parent = r.createElement('box')
  const comment = r.createComment('container')
  r.appendChild(parent, comment)
  const child = r.createElement('box')
  r.insertBefore(parent, child, comment)
  expect(parent.getChildren()[0]).toBe(child)
  expect((comment as BoxRenderable).visible).toBe(false)
})

test('setProperty and coercing setAttribute hit renderable setters', () => {
  const box = r.createElement('box') as BoxRenderable
  r.setProperty(box, 'title', 'hi')
  expect(box.title).toBe('hi')
  r.setAttribute(box, 'visible', 'false')
  expect(box.visible).toBe(false)
  r.setAttribute(box, 'flexGrow', '2')
  r.setAttribute(box, 'border', 'true')
  expect(box.border).toBe(true)
})

test('listen subscribes and unsubscribe removes', () => {
  const box = r.createElement('box')
  let hits = 0
  const off = r.listen(box, 'ping', () => {
    hits++
  })
  box.emit('ping')
  off()
  box.emit('ping')
  expect(hits).toBe(1)
})

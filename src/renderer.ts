import type { Renderer2, RendererFactory2 } from '@angular/core'
import {
  BaseRenderable,
  BoxRenderable,
  type CliRenderer,
  type Renderable,
  TextNodeRenderable,
  TextRenderable,
} from '@opentui/core'
import { ELEMENTS } from './elements'

function coerce(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value)
  return value
}

export class TuiRenderer implements Renderer2 {
  readonly data: Record<string, unknown> = {}
  destroyNode = (node: unknown): void => {
    ;(node as BaseRenderable).destroy()
  }

  constructor(private readonly ctx: CliRenderer) {}

  destroy(): void {}

  createElement(name: string): Renderable {
    const ctor = ELEMENTS[name]
    if (!ctor) {
      throw new Error(
        `ngx-opentui: unknown element <${name}>. Known elements: ${Object.keys(ELEMENTS).join(', ')}`,
      )
    }
    return new ctor(this.ctx, {})
  }

  // Angular anchors embedded views (@if/@for) on comment nodes; an
  // invisible zero-size box occupies the slot without rendering.
  createComment(_value: string): Renderable {
    return new BoxRenderable(this.ctx, { width: 0, height: 0, visible: false })
  }

  createText(value: string): TextNodeRenderable {
    return TextNodeRenderable.fromString(value)
  }

  appendChild(parent: BaseRenderable, newChild: BaseRenderable): void {
    this.assertValidChild(parent, newChild)
    parent.add(newChild)
  }

  insertBefore(parent: BaseRenderable, newChild: BaseRenderable, refChild: BaseRenderable | null): void {
    this.assertValidChild(parent, newChild)
    if (refChild) {
      parent.insertBefore(newChild, refChild)
    } else {
      parent.add(newChild)
    }
  }

  removeChild(parent: BaseRenderable | null, oldChild: BaseRenderable): void {
    const target = parent ?? oldChild.parent
    target?.remove(oldChild.id)
  }

  private assertValidChild(parent: BaseRenderable, child: BaseRenderable): void {
    const childIsText = child instanceof TextNodeRenderable
    const parentIsText = parent instanceof TextRenderable || parent instanceof TextNodeRenderable
    if (childIsText && !parentIsText) {
      throw new Error(`ngx-opentui: text must live inside <text>, not <${parent.constructor.name}>`)
    }
    if (!childIsText && parentIsText) {
      throw new Error(
        `ngx-opentui: only text may live inside <text> (got ${child.constructor.name}); @if/@for are not supported inside <text>`,
      )
    }
  }

  parentNode(node: BaseRenderable): BaseRenderable | null {
    return node.parent
  }

  nextSibling(node: BaseRenderable): BaseRenderable | null {
    const siblings = node.parent?.getChildren() ?? []
    const idx = siblings.indexOf(node as never)
    return idx >= 0 ? (siblings[idx + 1] ?? null) : null
  }

  selectRootElement(): never {
    throw new Error('ngx-opentui: selectRootElement is unsupported; bootstrapTuiApplication provides the host')
  }

  setAttribute(el: Renderable, name: string, value: string): void {
    ;(el as unknown as Record<string, unknown>)[name] = coerce(value)
  }

  removeAttribute(el: Renderable, name: string): void {
    ;(el as unknown as Record<string, unknown>)[name] = undefined
  }

  setProperty(el: Renderable, name: string, value: unknown): void {
    ;(el as unknown as Record<string, unknown>)[name] = value
  }

  setStyle(el: Renderable, style: string, value: unknown): void {
    ;(el as unknown as Record<string, unknown>)[style] = value
  }

  removeStyle(el: Renderable, style: string): void {
    ;(el as unknown as Record<string, unknown>)[style] = undefined
  }

  addClass(_el: Renderable, _name: string): void {}
  removeClass(_el: Renderable, _name: string): void {}

  setValue(node: TextNodeRenderable, value: string): void {
    node.clear()
    node.add(value)
  }

  listen(target: Renderable, event: string, callback: (event: unknown) => boolean | void): () => void {
    target.on(event, callback)
    return () => {
      target.off(event, callback)
    }
  }
}

export class TuiRendererFactory implements RendererFactory2 {
  private readonly renderer: TuiRenderer

  constructor(ctx: CliRenderer) {
    this.renderer = new TuiRenderer(ctx)
  }

  createRenderer(): Renderer2 {
    return this.renderer
  }
}

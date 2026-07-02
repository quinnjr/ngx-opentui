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

function isTextParent(parent: BaseRenderable): boolean {
  return parent instanceof TextRenderable || parent instanceof TextNodeRenderable
}

// Angular anchors embedded views (@if/@for) on comment nodes, created
// before their parent is known — but the OpenTUI node type depends on the
// parent: a TextNodeRenderable inside <text>, an invisible zero-size box
// anywhere else. The wrapper is the stable identity Angular holds; the
// real node materializes on first attach.
export class TuiComment {
  node: BaseRenderable | null = null

  constructor(private readonly ctx: CliRenderer) {}

  materialize(parent: BaseRenderable): BaseRenderable {
    this.node ??= isTextParent(parent)
      ? new TextNodeRenderable({})
      : new BoxRenderable(this.ctx, { width: 0, height: 0, visible: false })
    return this.node
  }
}

type TuiNode = BaseRenderable | TuiComment

function resolve(node: TuiNode | null): BaseRenderable | null {
  return node instanceof TuiComment ? node.node : node
}

export class TuiRenderer implements Renderer2 {
  readonly data: Record<string, unknown> = {}
  destroyNode = (node: unknown): void => {
    resolve(node as TuiNode)?.destroy()
  }

  constructor(private readonly ctx: CliRenderer) {}

  destroy(): void {}

  createElement(name: string): BaseRenderable {
    // <span> is inline styled text (fg/bg/attributes), the only element
    // kind that can live inside <text>; its constructor takes no context
    if (name === 'span') return new TextNodeRenderable({})
    const ctor = ELEMENTS[name]
    if (ctor) return new ctor(this.ctx, {})
    // A hyphenated, unmapped tag is an Angular component selector (e.g.
    // <tool-card>): Angular creates a real host node for a component and
    // renders the component's own template as children inside it, exactly
    // like a custom element. That host has no intrinsic TUI presentation of
    // its own, so it becomes a plain content-sized BoxRenderable — a
    // transparent pass-through container for whatever the component renders.
    if (name.includes('-')) return new BoxRenderable(this.ctx, {})
    throw new Error(
      `ngx-opentui: unknown element <${name}>. Known elements: span, ${Object.keys(ELEMENTS).join(', ')}`,
    )
  }

  createComment(_value: string): TuiComment {
    return new TuiComment(this.ctx)
  }

  createText(value: string): TextNodeRenderable {
    return TextNodeRenderable.fromString(value)
  }

  appendChild(parent: BaseRenderable, newChild: TuiNode): void {
    const child = newChild instanceof TuiComment ? newChild.materialize(parent) : newChild
    this.assertValidChild(parent, child)
    parent.add(child)
  }

  insertBefore(parent: BaseRenderable, newChild: TuiNode, refChild: TuiNode | null): void {
    const child = newChild instanceof TuiComment ? newChild.materialize(parent) : newChild
    this.assertValidChild(parent, child)
    const ref = resolve(refChild)
    if (ref) {
      parent.insertBefore(child, ref)
    } else {
      parent.add(child)
    }
  }

  removeChild(parent: BaseRenderable | null, oldChild: TuiNode): void {
    const child = resolve(oldChild)
    if (!child) return
    const target = parent ?? child.parent
    target?.remove(child.id)
  }

  private assertValidChild(parent: BaseRenderable, child: BaseRenderable): void {
    const childIsText = child instanceof TextNodeRenderable
    const parentIsText = isTextParent(parent)
    if (childIsText && !parentIsText) {
      throw new Error(`ngx-opentui: text must live inside <text>, not <${parent.constructor.name}>`)
    }
    if (!childIsText && parentIsText) {
      throw new Error(
        `ngx-opentui: only text may live inside <text> (got ${child.constructor.name}); a terminal text run holds styled chunks, not layout nodes — use <span> for inline styled content`,
      )
    }
  }

  parentNode(node: TuiNode): BaseRenderable | null {
    return resolve(node)?.parent ?? null
  }

  nextSibling(node: TuiNode): BaseRenderable | null {
    const real = resolve(node)
    if (!real) return null
    const siblings = real.parent?.getChildren() ?? []
    const idx = siblings.indexOf(real as never)
    return idx >= 0 ? (siblings[idx + 1] ?? null) : null
  }

  // createComponent() routes its hostElement through here; selector
  // strings have nothing to resolve against in a terminal.
  selectRootElement(selectorOrNode: unknown): Renderable {
    if (selectorOrNode instanceof BaseRenderable) {
      return selectorOrNode as Renderable
    }
    throw new Error(
      `ngx-opentui: cannot select root element by selector (got ${String(selectorOrNode)}); pass a renderable host`,
    )
  }

  setAttribute(el: BaseRenderable, name: string, value: string): void {
    ;(el as unknown as Record<string, unknown>)[name] = coerce(value)
  }

  removeAttribute(el: BaseRenderable, name: string): void {
    ;(el as unknown as Record<string, unknown>)[name] = undefined
  }

  setProperty(el: BaseRenderable, name: string, value: unknown): void {
    const target = el as unknown as Record<string, unknown>
    // two-way echo guard: re-assigning the value an input already holds
    // would move its cursor to the end on every keystroke
    if (name === 'value' && target['value'] === value) return
    target[name] = value
  }

  setStyle(el: BaseRenderable, style: string, value: unknown): void {
    ;(el as unknown as Record<string, unknown>)[style] = value
  }

  removeStyle(el: BaseRenderable, style: string): void {
    ;(el as unknown as Record<string, unknown>)[style] = undefined
  }

  addClass(_el: BaseRenderable, _name: string): void {}
  removeClass(_el: BaseRenderable, _name: string): void {}

  setValue(node: TextNodeRenderable, value: string): void {
    node.clear()
    node.add(value)
  }

  listen(target: BaseRenderable, event: string, callback: (event: unknown) => boolean | void): () => void {
    // (valueChange) has no OpenTUI equivalent; inputs emit "input" with the
    // new value, which is exactly the $event [(value)] needs
    const mapped = event === 'valueChange' ? 'input' : event
    target.on(mapped, callback)
    return () => {
      target.off(mapped, callback)
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

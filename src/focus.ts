import { Injectable, inject } from '@angular/core'
import { CliRenderer, type Renderable } from '@opentui/core'
import { TuiKeyboard } from './keyboard'

@Injectable({ providedIn: 'root' })
export class TuiFocus {
  private readonly renderer = inject(CliRenderer)
  private readonly keyboard = inject(TuiKeyboard)

  // Focus order is document order: depth-first over the renderable tree.
  focusables(): Renderable[] {
    const found: Renderable[] = []
    const walk = (node: Renderable): void => {
      if (node.focusable && node.visible) found.push(node)
      for (const child of node.getChildren()) walk(child)
    }
    walk(this.renderer.root)
    return found
  }

  current(): Renderable | null {
    return this.focusables().find((r) => r.focused) ?? null
  }

  focusNext(): void {
    this.move(1)
  }

  focusPrevious(): void {
    this.move(-1)
  }

  private move(step: 1 | -1): void {
    const focusables = this.focusables()
    if (focusables.length === 0) return
    const index = focusables.findIndex((r) => r.focused)
    const next = index === -1
      ? (step === 1 ? focusables[0] : focusables[focusables.length - 1])
      : focusables[(index + step + focusables.length) % focusables.length]
    next!.focus()
  }

  // Tab / shift+tab cycling; preventDefault keeps the focused input from
  // also receiving the tab. Returns a teardown function.
  enableTabCycling(): () => void {
    return this.keyboard.onKey((key) => {
      if (key.name !== 'tab') return
      key.preventDefault()
      if (key.shift) {
        this.focusPrevious()
      } else {
        this.focusNext()
      }
    })
  }
}

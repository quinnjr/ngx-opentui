import { Injectable, type OnDestroy, inject } from '@angular/core'
import { CliRenderer, type KeyEvent } from '@opentui/core'

@Injectable({ providedIn: 'root' })
export class TuiKeyboard implements OnDestroy {
  private readonly renderer = inject(CliRenderer)
  private readonly handlers = new Set<(key: KeyEvent) => void>()
  private readonly listener = (key: KeyEvent): void => {
    for (const handler of this.handlers) handler(key)
  }

  constructor() {
    this.renderer.keyInput.on('keypress', this.listener)
  }

  onKey(handler: (key: KeyEvent) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  ngOnDestroy(): void {
    this.renderer.keyInput.off('keypress', this.listener)
  }
}

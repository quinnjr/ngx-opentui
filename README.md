# ngx-opentui

Experimental Angular renderer for [OpenTUI](https://github.com/anomalyco/opentui) — the Angular counterpart of `@opentui/react` and `@opentui/solid`. Angular templates, signals, and DI drive a terminal UI: a custom `Renderer2` maps Angular's element operations onto OpenTUI renderables, with no DOM and no `platform-browser`.

**Status: proof of concept.** JIT-only, Bun-only, APIs will change.

## Requirements

- [Bun](https://bun.sh) — mandatory, not a preference: `@opentui/core` loads its native layer via `bun:ffi`
- Angular ≥ 22, zoneless (no zone.js)

## Quick start

```ts
// app.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal, inject } from '@angular/core'
import { bootstrapTuiApplication, TuiKeyboard } from 'ngx-opentui'

@Component({
  selector: 'counter-app',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <box border="true" title=" counter " padding="1">
      <text>count: {{ count() }}@if (count() > 9) {<span fg="#7fbf7f"> nice</span>}</text>
    </box>
  `,
})
class CounterApp {
  readonly count = signal(0)
  constructor() {
    inject(TuiKeyboard).onKey((key) => {
      if (key.name === 'up') this.count.update((c) => c + 1)
      if (key.name === 'q') process.exit(0)
    })
  }
}

await bootstrapTuiApplication(CounterApp)
```

```sh
bun run app.ts
```

No build step — templates compile at startup via `@angular/compiler`.

## Elements

| Tag | OpenTUI renderable | Notes |
|-----|--------------------|-------|
| `<box>` | `BoxRenderable` | flexbox layout (Yoga), border, title |
| `<text>` | `TextRenderable` | text content lives here |
| `<span>` | `TextNodeRenderable` | styled inline text (`fg`, `bg`, `attributes`); only valid inside `<text>` |
| `<input>` | `InputRenderable` | void element; supports `[(value)]`, `(enter)`, `(input)`, `(change)` |
| `<select>` | `SelectRenderable` | `(selectionChanged)`, `(itemSelected)` |
| `<scrollbox>` | `ScrollBoxRenderable` | |
| `<ascii-font>` | `ASCIIFontRenderable` | |

Layout and style props bind straight to renderable setters: `flexDirection`, `padding`, `width`, `border`, `title`, `backgroundColor`, ...

## Services

- **`TuiKeyboard`** — global key events through DI: `onKey(handler)` returns an unsubscribe function.
- **`TuiFocus`** — document-order focus traversal: `focusNext()`, `focusPrevious()`, `current()`, and opt-in `enableTabCycling()` for tab/shift+tab.

## What works

- `@if` / `@for` / bindings / signals / computed / DI — anywhere, including inside `<text>`
- Two-way `[(value)]` on inputs (cursor position survives the change-detection echo)
- Styled inline fragments: `@if (err()) {<span fg="#ff0000">ERROR</span>}` inside a single text run
- Zoneless change detection scheduled onto OpenTUI's frame loop

## Known limitations

- **JIT-mode Angular**: use the `@ViewChild` decorator, not signal-based `viewChild()` queries (invisible to the JIT compiler); DI via `inject()`, not constructor parameters
- `<input>` is a void element in Angular's template parser — write `<input />`, never `</input>`
- Layout elements (`<box>` etc.) cannot live inside `<text>` — terminal text runs hold styled chunks, not layout nodes; use `<span>`
- Component `styles` are meaningless in a terminal and unsupported

## Development

```sh
bun install
bun test            # unit + e2e against OpenTUI's headless test renderer
bun run typecheck
bun run demo        # interactive task-list demo
```

## License

[MIT](LICENSE)

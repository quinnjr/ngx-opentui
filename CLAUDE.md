# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Experimental Angular renderer for OpenTUI (the Angular counterpart of `@opentui/react`). A custom `Renderer2` maps Angular template operations onto `@opentui/core` renderables; there is no DOM, no `platform-browser`, no zone.js, and no build step (JIT via `@angular/compiler` at startup).

## Commands

Everything runs under **Bun — Node does not work** (`@opentui/core` loads its Zig native layer via `bun:ffi`; this is also why tests use `bun test`, not vitest).

```sh
bun test                          # full suite
bun test tests/renderer.test.ts   # single file
bun test -t 'pattern'             # single test by name
bun run typecheck                 # bunx tsc --noEmit
bun run demo                      # interactive task-list demo (real terminal)
```

## Architecture

Three layers in `src/`, all exported through `src/index.ts`:

- **`renderer.ts`** — `TuiRenderer implements Renderer2`. The whole binding hangs off this seam: `@if`/`@for`/bindings/signals reduce to ~15 element ops. Tag names resolve via the registry in `elements.ts` (`box`, `text`, `input`, `select`, `scrollbox`, `ascii-font`); `span` is special-cased in `createElement` because `TextNodeRenderable`'s constructor takes no render context. Property/attribute setters assign straight onto renderable setters (attributes go through string coercion).
- **`bootstrap.ts`** — `bootstrapTuiApplication()`. Builds the app injector with `ɵinternalCreateApplication`, then mounts the root component onto `renderer.root` via `createComponent({hostElement})`, routed through the renderer's `selectRootElement`. Owns the `CliRenderer` unless one is passed in (`options.renderer` — how tests inject the headless renderer).
- **`keyboard.ts` / `focus.ts`** — `TuiKeyboard` (global keypress via `renderer.keyInput`) and `TuiFocus` (document-order focus traversal + opt-in tab cycling). Both `providedIn: 'root'`, injecting `CliRenderer` as the DI token.

### Invariants that are not obvious from any single file

- **Text containment**: text nodes and `<span>`s may only live under `<text>` (OpenTUI text buffers hold styled chunks, not layout nodes); layout renderables may not. `assertValidChild` in `renderer.ts` enforces both directions with descriptive errors. Don't weaken it — a violation renders as nothing.
- **Comment anchors are lazy** (`TuiComment` in `renderer.ts`): Angular creates `@if`/`@for` anchors before the parent is known, but the OpenTUI node type depends on the parent (childless `TextNodeRenderable` inside text, invisible zero-size `BoxRenderable` elsewhere). The wrapper is the identity Angular holds; every tree op must `resolve()` it. A never-attached comment resolves to `null` — removal/destroy must stay no-ops.
- **Bootstrap replaces four things platform-browser normally provides** (see comments in `bootstrap.ts`): `INJECTOR_SCOPE: 'root'` (without it *no* `providedIn:'root'` token resolves), `IMAGE_CONFIG` with warnings disabled (Bun defines `PerformanceObserver`, so Angular's dev image scanner would demand a document), a `{head: null}` `DOCUMENT` stub (style-host lookup runs even for style-less components), and **deferred `requestAnimationFrame`**: OpenTUI installs a global rAF that can fire synchronously inside its render loop, and Angular's zoneless scheduler must never tick in the signal notification phase — the `queueMicrotask` wrapper in `deferAnimationFrameCallbacks` is what makes signal-driven re-renders work at all. Symptom if it regresses: signals update, screen doesn't.
- **Two-way echo guard**: `setProperty` skips writing `value` when unchanged, otherwise the CD echo after each keystroke snaps the input cursor to the end. `listen()` maps Angular's synthesized `valueChange` to OpenTUI's `input` event.
- **Errors must tear down the terminal first**: `TuiErrorHandler` destroys the `CliRenderer` before printing, because anything printed while the alternate screen is active is wiped with it (crash → silent blank exit).

### JIT constraints (apply to all components, including tests and demo)

- DI via `inject()` only — constructor parameter injection needs decorator metadata Bun doesn't reliably emit.
- `@ViewChild` decorator, never signal-based `viewChild()` — initializer-based queries are invisible to the JIT compiler (fails at runtime with NG0951).
- `<input>` is a void element to Angular's parser: `<input />`, never `</input>`.
- Components need `schemas: [CUSTOM_ELEMENTS_SCHEMA]`.

## Testing

Tests run against OpenTUI's headless renderer: `createTestRenderer({width, height})` from `@opentui/core/testing`, passed into `bootstrapTuiApplication` via `options.renderer`. Assert on `captureCharFrame()` strings; use `waitForFrame(predicate)` for anything after a signal update (zoneless CD is async). Renderer unit tests assert on the node tree via `text.textNode.toChunks()` — `text.chunks` only populates during render passes. If a test needs a lone Escape keypress, create the test renderer with `kittyKeyboard: true`; in the legacy protocol a bare ESC is ambiguous and never fires as a key event in the mock.

## Conventions

git-flow (`main`/`develop`, feature branches via `.worktrees/`, squash-merge to develop). Personal project — no Jira ticket prefix in branches or commits, plain Conventional Commits. GitHub remote (`quinnjr/ngx-opentui`): no CodeBuild review-bot gate, rely on CI checks.

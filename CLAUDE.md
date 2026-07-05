# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Experimental Angular renderer for OpenTUI (the Angular counterpart of `@opentui/react`). A custom `Renderer2` maps Angular template operations onto `@opentui/core` renderables; there is no DOM, no `platform-browser`, no zone.js. Apps run JIT by default (`@angular/compiler` at startup) but can opt into AOT via `ngx-opentui/aot` (see Architecture below).

## Commands

Everything runs under **Bun — Node does not work** (`@opentui/core` loads its Zig native layer via `bun:ffi`; this is also why tests use `bun test`, not vitest).

```sh
bun test                          # full suite
bun test tests/renderer.test.ts   # single file
bun test -t 'pattern'             # single test by name
bun run typecheck                 # bunx tsc --noEmit
bun run test:coverage             # fails unless src coverage is 100% funcs+lines
bun run demo                      # interactive task-list demo (real terminal)
```

## Architecture

Three layers in `src/`, all exported through `src/index.ts`:

- **`renderer.ts`** — `TuiRenderer implements Renderer2`. The whole binding hangs off this seam: `@if`/`@for`/bindings/signals reduce to ~15 element ops. Tag names resolve via the registry in `elements.ts` (`box`, `text`, `input`, `select`, `scrollbox`, `ascii-font`); `span` is special-cased in `createElement` because `TextNodeRenderable`'s constructor takes no render context. Property/attribute setters assign straight onto renderable setters (attributes go through string coercion).
- **`bootstrap.ts`** — `bootstrapTuiApplication()`. Builds the app injector with `ɵinternalCreateApplication`, then mounts the root component onto `renderer.root` via `createComponent({hostElement})`, routed through the renderer's `selectRootElement`. Owns the `CliRenderer` unless one is passed in (`options.renderer` — how tests inject the headless renderer).
- **`keyboard.ts` / `focus.ts`** — `TuiKeyboard` (global keypress via `renderer.keyInput`) and `TuiFocus` (document-order focus traversal + opt-in tab cycling). Both `providedIn: 'root'`, injecting `CliRenderer` as the DI token.

### AOT builder (`src/aot/`, exported as `ngx-opentui/aot`)

Optional opt-in build path, separate from the JIT-by-default runtime above:

- **`plugin.ts`** — `ngxOpenTuiAot(options?)`, a Bun build plugin. On `setup()` it runs `@angular/compiler-cli`'s `readConfiguration` → `createCompilerHost` → `performCompilation` **once** over the whole tsconfig file graph (ngtsc needs cross-file metadata, so this can't be a per-file transform), capturing every emitted `.js` into a `Map` keyed by the *original* absolute `.ts` source path (via the `sourceFiles` param `host.writeFile` receives — robust regardless of `outDir`). `onLoad` then serves pre-emitted source for any matched path and returns `undefined` (passthrough) for anything ngtsc didn't touch.
- **`cli.ts`** — `runAotCli(argv)`, a thin wrapper: parses `entry`, `--outdir` (default `dist`), `--tsconfig`, calls `Bun.build()` with the plugin, marks `@opentui/core` external (see below), throws with formatted diagnostics on failure.
- **`bin/ngx-opentui-aot.ts`** — shebang entry (`package.json`'s `bin`).

**Non-obvious constraints discovered building this:**
- `CUSTOM_ELEMENTS_SCHEMA` (used everywhere per the JIT constraints below) only suppresses ngtsc's NG8001 for **hyphenated** tag names — this renderer's own elements (`box`, `text`, `input`, `span`, ...) aren't hyphenated, so it's a no-op under AOT. Components that need AOT must use `NO_ERRORS_SCHEMA` instead (see `demo/app.component.ts`); this doesn't change JIT behavior since JIT has the same dash-check gap.
- `@opentui/core` must always be marked `external` in any `Bun.build()` that uses this plugin — it resolves its native Zig layer through platform-specific optional dependencies chosen at runtime, and bundling it makes Bun try to statically resolve every platform's package.
- `@angular/core` only needs to be `external` when a component is AOT-compiled in a *separate* `Bun.build()` call from the code that bootstraps it (e.g. tests that build a fixture, then `import()` it into an already-running process) — otherwise two live copies of `@angular/core` end up with separate DI globals (`NG0203`). A single build covering the whole entry point (component + `bootstrapTuiApplication` call) doesn't need this.
- `scripts/check-coverage.sh`'s gate checks only rows whose path starts with `src/` (not bun's "All files" aggregate) — once tests started importing generated AOT build artifacts and `demo/app.component.ts`, the aggregate stopped meaning "100% of src".
- `Bun.build()`'s JS API requires `outfile` nested inside `compile` (`compile: { outfile }`) for standalone executables — a top-level `outfile` alongside `compile: true` is silently ignored by the programmatic API (it writes to a name derived from the entry point in the cwd instead), even though this is how the CLI's own `--compile`/`--outfile` flags are documented to pair and how Bun's own type-doc example shows it. `src/aot/cli.ts` always uses the nested form.

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
- Components need `schemas: [CUSTOM_ELEMENTS_SCHEMA]` (except components compiled via the AOT builder — see above).

## Testing

Tests run against OpenTUI's headless renderer: `createTestRenderer({width, height})` from `@opentui/core/testing`, passed into `bootstrapTuiApplication` via `options.renderer`. Assert on `captureCharFrame()` strings; use `waitForFrame(predicate)` for anything after a signal update (zoneless CD is async). Renderer unit tests assert on the node tree via `text.textNode.toChunks()` — `text.chunks` only populates during render passes. If a test needs a lone Escape keypress, create the test renderer with `kittyKeyboard: true`; in the legacy protocol a bare ESC is ambiguous and never fires as a key event in the mock.

## Conventions

git-flow (`main`/`develop`, feature branches via `.worktrees/`, squash-merge to develop). Personal project — no Jira ticket prefix in branches or commits, plain Conventional Commits. GitHub remote (`quinnjr/ngx-opentui`): no CodeBuild review-bot gate, rely on CI checks.

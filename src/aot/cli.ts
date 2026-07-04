import { ngxOpenTuiAot } from './plugin'

export interface RunAotCliResult {
  /** The resolved output directory the build was written to. */
  outdir: string
}

export async function runAotCli(argv: string[]): Promise<RunAotCliResult> {
  const entry = argv.find((arg) => !arg.startsWith('-'))
  if (!entry) {
    throw new Error('ngx-opentui-aot: missing required entry argument, e.g. `ngx-opentui-aot ./src/main.ts`')
  }

  const outdirIndex = argv.indexOf('--outdir')
  const outdir = outdirIndex !== -1 ? argv[outdirIndex + 1] : 'dist'
  if (!outdir) {
    throw new Error('ngx-opentui-aot: --outdir requires a value')
  }

  const tsconfigIndex = argv.indexOf('--tsconfig')
  const tsconfig = tsconfigIndex !== -1 ? argv[tsconfigIndex + 1] : undefined
  if (tsconfigIndex !== -1 && !tsconfig) {
    throw new Error('ngx-opentui-aot: --tsconfig requires a value')
  }

  const result = await Bun.build({
    entrypoints: [entry],
    outdir,
    plugins: [ngxOpenTuiAot({ tsconfig })],
    // @opentui/core resolves its native Zig layer through one of several
    // platform-specific optional dependencies (e.g. @opentui/core-linux-x64)
    // chosen dynamically at runtime; only the package matching the current
    // platform/arch is actually installed. Bundling @opentui/core would make
    // Bun's bundler try to statically resolve every branch, which fails on
    // any machine that doesn't have all of them installed. Marking it
    // external leaves the import for Bun's own module resolution to handle
    // at run time, same as running the app directly with `bun`.
    external: ['@opentui/core'],
    throw: false,
  })

  if (!result.success) {
    const messages = result.logs.map((log) => log.message).join('\n')
    throw new Error(`ngx-opentui-aot: build failed\n${messages}`)
  }

  return { outdir }
}

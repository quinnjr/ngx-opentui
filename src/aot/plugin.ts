import { resolve } from 'node:path'
import {
  createCompilerHost,
  formatDiagnostics,
  performCompilation,
  readConfiguration,
} from '@angular/compiler-cli'
import ts from 'typescript'
import type { BunPlugin } from 'bun'

export interface NgxOpenTuiAotOptions {
  /** Path to the tsconfig.json to compile against. Defaults to "tsconfig.json" in the current working directory. */
  tsconfig?: string
}

interface CompilationResult {
  emitted: Map<string, string>
  error?: Error
}

function compileToEmittedSources(tsconfigPath: string): CompilationResult {
  try {
    const config = readConfiguration(tsconfigPath, { noEmit: false })
    const emitted = new Map<string, string>()
    if (config.errors.length > 0) {
      return { emitted, error: new Error(formatDiagnostics(config.errors)) }
    }
    const host = createCompilerHost({ options: config.options })
    host.writeFile = (fileName, data, _writeByteOrderMark, _onError, sourceFiles) => {
      if (!fileName.endsWith('.js') || !sourceFiles || sourceFiles.length === 0) return
      // This project's tsconfig never enables i18n merging or single-file bundled
      // emit, so ngtsc always emits one .js per one .ts source: sourceFiles[0] is
      // the sole contributing file. If that ever changes, later sourceFiles would
      // be silently dropped here.
      emitted.set(resolve(sourceFiles[0]!.fileName), data)
    }

    const result = performCompilation({ rootNames: config.rootNames, options: config.options, host })
    const errors = result.diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error)
    if (errors.length > 0) {
      return { emitted, error: new Error(formatDiagnostics(errors)) }
    }
    return { emitted }
  } catch (err) {
    return { emitted: new Map(), error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export function ngxOpenTuiAot(options: NgxOpenTuiAotOptions = {}): BunPlugin {
  return {
    name: 'ngx-opentui-aot',
    setup(build) {
      const tsconfigPath = resolve(options.tsconfig ?? 'tsconfig.json')
      const { emitted, error } = compileToEmittedSources(tsconfigPath)

      build.onLoad({ filter: /\.ts$/ }, (args) => {
        if (error) throw error
        const source = emitted.get(resolve(args.path))
        if (source === undefined) return undefined
        return { contents: source, loader: 'js' }
      })
    },
  }
}

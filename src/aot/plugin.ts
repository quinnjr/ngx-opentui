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
  const config = readConfiguration(tsconfigPath, { noEmit: false })
  const emitted = new Map<string, string>()
  const host = createCompilerHost({ options: config.options })
  host.writeFile = (fileName, data, _writeByteOrderMark, _onError, sourceFiles) => {
    if (!fileName.endsWith('.js') || !sourceFiles || sourceFiles.length === 0) return
    emitted.set(resolve(sourceFiles[0]!.fileName), data)
  }

  const result = performCompilation({ rootNames: config.rootNames, options: config.options, host })
  const errors = result.diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error)
  if (errors.length > 0) {
    return { emitted, error: new Error(formatDiagnostics(errors)) }
  }
  return { emitted }
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

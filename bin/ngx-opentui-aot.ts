#!/usr/bin/env bun
import { runAotCli } from '../src/aot/cli'

await runAotCli(process.argv.slice(2))

#!/bin/sh
# Fails unless the suite passes AND src coverage is 100% funcs + lines.
# ponytail: bun 1.3.5 prints coverageThreshold but does not enforce it;
# drop this script for bunfig coverageThreshold once bun actually fails the run.
#
# Only rows whose file path starts with `src/` are checked (not the "All
# files" aggregate). Tests dynamically import() AOT-compiled build artifacts
# under gitignored `.tmp-aot-*/` scratch dirs and directly import
# `demo/app.component.ts`; bun's coverage instrumentation picks those up too,
# and they're far below 100% (generated bundler output nobody hand-writes
# tests against, or an interactive terminal demo never meant to be covered by
# this gate). Scoping to `src/` rows checks exactly what the gate promises.
set -e
# Some AOT test fixtures produce coverage rows with extremely long
# "Uncovered Line #s" columns (built bundler artifacts spanning thousands of
# lines). Capturing bun's output through a pipe/command-substitution can trip
# an internal write error on those lines, so write straight to a temp file
# instead, which doesn't hit that pipe-buffer path.
tmpout=$(mktemp)
trap 'rm -f "$tmpout"' EXIT
bun test --coverage >"$tmpout" 2>&1 || { cat "$tmpout"; exit 1; }
cat "$tmpout"
awk -F'|' '$1 ~ /^ src\// {
  gsub(/ /, "", $2); gsub(/ /, "", $3)
  found = 1
  if ($2 != "100.00" || $3 != "100.00") {
    print "FAIL: " $1 " below 100% (funcs " $2 ", lines " $3 ")"
    failed = 1
  }
}
END {
  if (!found) { print "FAIL: no src/ coverage rows found"; exit 1 }
  if (failed) { exit 1 }
}' "$tmpout"

#!/bin/sh
# Fails unless the suite passes AND src coverage is 100% funcs + lines.
# ponytail: bun 1.3.5 prints coverageThreshold but does not enforce it;
# drop this script for bunfig coverageThreshold once bun actually fails the run.
set -e
out=$(bun test --coverage 2>&1) || { printf '%s\n' "$out"; exit 1; }
printf '%s\n' "$out"
printf '%s\n' "$out" | awk -F'|' '/^All files/ {
  gsub(/ /, "", $2); gsub(/ /, "", $3)
  if ($2 != "100.00" || $3 != "100.00") { print "FAIL: coverage below 100% (funcs " $2 ", lines " $3 ")"; exit 1 }
  found = 1
}
END { if (!found) { print "FAIL: no coverage summary found"; exit 1 } }'

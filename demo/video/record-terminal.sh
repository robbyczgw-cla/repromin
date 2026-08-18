#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export FORCE_COLOR=1
export NO_COLOR=
export NODE_NO_WARNINGS=1
export NODE_OPTIONS="${NODE_OPTIONS:-} --no-warnings"

echo
echo "$ npx tsx src/cli.ts fixtures/tests/killer.spec.ts --test \"checkout crashes\" --dry-run"
echo
npx tsx src/cli.ts fixtures/tests/killer.spec.ts --test "checkout crashes" --dry-run
echo
echo "$ npx tsx src/cli.ts fixtures/tests/g-compact.spec.ts --test \"compact checkout crash\" --confirm 2 --verbose"
echo
npx tsx src/cli.ts fixtures/tests/g-compact.spec.ts \
  --test "compact checkout crash" \
  --confirm 2 \
  --verbose \
  --timeout 8000 \
  --config fixtures/playwright.config.ts
echo

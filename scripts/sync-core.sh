#!/usr/bin/env bash
# Copies BabyTrails' shared core (src/core/ and its unit tests) into this repository at a given
# commit, and records the commit in src/core/SOURCE. Copies from the commit itself (git archive), never
# from BabyTrails' working tree, so uncommitted changes there can't leak in.
#
#   scripts/sync-core.sh <commit> [path to a babytrails clone, default ../babytrails]
#
# src/core/ is never edited here; changes go to BabyTrails as requests.
set -euo pipefail

commit="${1:?usage: scripts/sync-core.sh <commit> [babytrails clone]}"
source_repo="${2:-../babytrails}"
here="$(cd "$(dirname "$0")/.." && pwd)"
tests=(tests/unit/vault.test.ts tests/unit/backup.test.ts tests/unit/settings.test.ts)

full="$(git -C "$source_repo" rev-parse --verify "$commit^{commit}")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git -C "$source_repo" archive "$full" src/core "${tests[@]}" | tar -x -C "$tmp"

rm -rf "$here/src/core"
cp -R "$tmp/src/core" "$here/src/core"
for t in "${tests[@]}"; do cp "$tmp/$t" "$here/$t"; done

cat > "$here/src/core/SOURCE" <<SRC
Copied from https://github.com/tbutman/babytrails at commit $full
by scripts/sync-core.sh. Don't edit files in src/core/ here; change them in BabyTrails.
Also copied: ${tests[*]}
SRC
echo "Copied src/core/ from babytrails@${full:0:7}"

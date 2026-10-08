#!/usr/bin/env bash
# Copies BabyTrails' shared core (src/core/ and its unit tests) into this repository at a given
# commit, and records the commit in src/core/SOURCE. Copies from the commit itself (git archive), never
# from BabyTrails' working tree, so uncommitted changes there can't leak in.
#
#   scripts/sync-core.sh <commit> [path to a babytrails clone, default ../babytrails] [branch, default origin/main]
#
# The commit must be on the given branch of BabyTrails (origin/main unless named), so a core that was
# never merged can't be copied by mistake. The list of the core's unit tests comes from BabyTrails'
# src/core/TESTS at that commit (one path per line; blank lines and "#" comments ignored), or, for
# commits from before that file existed, the list below.
#
# src/core/ is never edited here; changes go to BabyTrails as requests.
set -euo pipefail

commit="${1:?usage: scripts/sync-core.sh <commit> [babytrails clone] [branch]}"
source_repo="${2:-../babytrails}"
branch="${3:-origin/main}"
here="$(cd "$(dirname "$0")/.." && pwd)"
# Helper scripts the core needs (copy-pdfjs self-hosts pdf.js's decoders and fonts).
scripts=(scripts/copy-pdfjs.mjs)

full="$(git -C "$source_repo" rev-parse --verify "$commit^{commit}")"
git -C "$source_repo" rev-parse --verify --quiet "$branch^{commit}" >/dev/null || {
  echo "No branch $branch in $source_repo" >&2
  exit 1
}
if ! git -C "$source_repo" merge-base --is-ancestor "$full" "$branch"; then
  echo "babytrails@${full:0:7} isn't on $branch; refusing to copy it." >&2
  exit 1
fi

if git -C "$source_repo" cat-file -e "$full:src/core/TESTS" 2>/dev/null; then
  tests=()
  while IFS= read -r line; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [ -n "$line" ] && tests+=("$line")
  done < <(git -C "$source_repo" show "$full:src/core/TESTS")
else
  tests=(tests/unit/vault.test.ts tests/unit/backup.test.ts tests/unit/settings.test.ts tests/unit/documents.test.ts tests/unit/review.test.ts tests/unit/ai.test.ts tests/unit/import.test.ts tests/unit/importPages.test.ts)
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git -C "$source_repo" archive "$full" src/core "${tests[@]}" "${scripts[@]}" | tar -x -C "$tmp"

rm -rf "$here/src/core"
mkdir -p "$here/src"
cp -R "$tmp/src/core" "$here/src/core"
for f in "${tests[@]}" "${scripts[@]}"; do
  mkdir -p "$here/$(dirname "$f")"
  cp "$tmp/$f" "$here/$f"
done

cat > "$here/src/core/SOURCE" <<SRC
Copied from https://github.com/tbutman/babytrails at commit $full
(on $branch) by scripts/sync-core.sh. Don't edit files in src/core/ here; change them in BabyTrails.
Also copied: ${tests[*]} ${scripts[*]}
SRC
echo "Copied src/core/ from babytrails@${full:0:7}"

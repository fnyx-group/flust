#!/usr/bin/env bash
# Fetches the latest version of a list source from its GitHub repository and updates its files,
# LICENSE and PROVENANCE. The change is then reviewed in a pull request like code, and
# `pnpm test` checks the license and the checksums (docs/decisions/0039-filter-lists-and-licenses.md).
# Usage: scripts/update-list-source.sh <source>, for example shadowwhisperer
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

if [[ $# -ne 1 || ! -f $root/lists/sources/$1/PROVENANCE ]]; then
  sources=("$root"/lists/sources/*/)
  sources=("${sources[@]%/}")
  echo "Usage: $0 <source>, one of: ${sources[*]##*/}" >&2
  exit 2
fi
folder=$root/lists/sources/$1
provenance=$folder/PROVENANCE

field() {
  sed -nE "s/^$1: (.*)$/\1/p" "$provenance"
}

url=$(field url)
license=$(field license)
repository=${url#https://github.com/}
if [[ $repository == "$url" || $repository != */* ]]; then
  echo "Only GitHub sources can be updated by this script: $url" >&2
  exit 2
fi

commit=$(curl -fsS "https://api.github.com/repos/$repository/commits/HEAD" |
  sed -nE 's/^  "sha": "([0-9a-f]{40})",$/\1/p' | head -n 1)
if [[ ! $commit =~ ^[0-9a-f]{40}$ ]]; then
  echo "Cannot read the latest commit of $repository" >&2
  exit 1
fi

download() {
  curl -fsS "https://raw.githubusercontent.com/$repository/$commit/$1" -o "$2"
}

download LICENSE "$folder/LICENSE"
{
  echo "url: $url"
  echo "commit: $commit"
  echo "date: $(date -u +%F)"
  echo "license: $license"
  while read -r upstream name; do
    download "$upstream" "$folder/$name"
    echo "file: $upstream $name sha256:$(sha256sum "$folder/$name" | cut -d ' ' -f 1)"
  done < <(sed -nE 's/^file: (\S+) (\S+) sha256:.*$/\1 \2/p' "$provenance")
} >"$provenance.new"
mv "$provenance.new" "$provenance"

echo "Updated $1 to $repository@$commit. Run pnpm test, then review the diff."

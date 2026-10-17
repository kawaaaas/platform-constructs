#!/usr/bin/env bash
# 部品の新しい版を公開する。
#   使い方: scripts/release.sh <patch|minor|major>
#     patch：不具合の修正  minor：互換のある変更（基準値の変更など）  major：互換が崩れる変更
# package.json の version を上げてコミットとタグ（v1.2.3）を作り、push する。
# タグの push で GitHub Actions（release.yml）がテストして CodeArtifact に公開する。
# 同じ位置に release/v1.2.3 のブランチも作る（その版から作業するときの入口。タグは動かせないため）。
set -euo pipefail
cd "$(dirname "$0")/.."

bump="${1:-}"
case "$bump" in
  patch | minor | major) ;;
  *) echo "使い方: $0 <patch|minor|major>" >&2; exit 1 ;;
esac

# 公開するのは main の最新だけ
[ "$(git branch --show-current)" = main ] || { echo "main で実行してください" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "コミットしていない変更があります" >&2; exit 1; }
git pull --ff-only --quiet

npm test
npm version "$bump" -m "v%s"
git push --follow-tags

version="v$(node -p "require('./package.json').version")"
git push origin "$version^{commit}:refs/heads/release/$version"   # タグは注釈付きなので、指しているコミットを渡す
echo "$version を push しました。release の結果を待ちます"
sleep 5
gh run watch "$(gh run list --workflow release.yml --branch "$version" --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status

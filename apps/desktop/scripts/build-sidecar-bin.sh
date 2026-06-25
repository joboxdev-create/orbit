#!/usr/bin/env bash
# Build the engine sidecar into a single self-contained executable using Node's
# SEA (Single Executable Applications). The result includes the Node runtime, so
# the packaged desktop app needs no Node installed — fully offline, local-first.
#
# Output: src-tauri/binaries/orbit-sidecar-<rust-target-triple>, the name Tauri's
# externalBin expects (it bundles it next to the app as `orbit-sidecar`).
set -euo pipefail
cd "$(dirname "$0")/.."

TRIPLE="$(rustc -vV | sed -n 's/host: //p')"
OUT_DIR="src-tauri/binaries"
BIN="$OUT_DIR/orbit-sidecar-$TRIPLE"
FUSE="NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"

mkdir -p "$OUT_DIR" .sidecar-build

echo "› bundling sidecar (esbuild)…"
pnpm exec esbuild sidecar/server.ts \
  --bundle --platform=node --target=node20 \
  --outfile=.sidecar-build/server.cjs

echo "› generating SEA blob…"
node --experimental-sea-config sea-config.json

echo "› creating executable from local node…"
cp "$(command -v node)" "$BIN"

echo "› injecting blob (postject)…"
pnpm exec postject "$BIN" NODE_SEA_BLOB .sidecar-build/sea-prep.blob \
  --sentinel-fuse "$FUSE"

chmod +x "$BIN"
echo "✓ built $BIN"

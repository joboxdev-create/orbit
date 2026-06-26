// Build orbit-mcp into a single self-contained executable (Node SEA), so the
// packaged app can expose its MCP server to agents without Node installed.
// Mirrors build-sidecar-bin.mjs. Cross-platform (Linux / macOS / Windows).
//
// Output: src-tauri/binaries/orbit-mcp-<rust-target-triple>[.exe] — the name
// Tauri's externalBin expects (bundled next to the app as `orbit-mcp`).
//
// Run from apps/desktop:  node scripts/build-mcp-bin.mjs
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { inject } from "postject";

const FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

const rustc = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
const triple = rustc.match(/^host:\s*(.+)$/m)?.[1]?.trim();
if (!triple) throw new Error("could not determine the Rust target triple");

const outDir = "src-tauri/binaries";
const binPath = join(outDir, `orbit-mcp-${triple}${isWin ? ".exe" : ""}`);

mkdirSync(outDir, { recursive: true });
mkdirSync(".mcp-build", { recursive: true });

console.log("› bundling orbit-mcp (esbuild)…");
await esbuild.build({
  entryPoints: ["mcp/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: ".mcp-build/server.cjs",
});

console.log("› generating SEA blob…");
run(process.execPath, ["--experimental-sea-config", "sea-config-mcp.json"]);

console.log("› copying Node runtime…");
copyFileSync(process.execPath, binPath);
if (isMac) run("codesign", ["--remove-signature", binPath]);

console.log("› injecting blob (postject)…");
await inject(binPath, "NODE_SEA_BLOB", readFileSync(".mcp-build/sea-prep.blob"), {
  sentinelFuse: FUSE,
  ...(isMac ? { machoSegmentName: "NODE_SEA" } : {}),
});

if (isMac) run("codesign", ["--sign", "-", binPath]);
if (!isWin) chmodSync(binPath, 0o755);

console.log(`✓ built ${binPath}`);

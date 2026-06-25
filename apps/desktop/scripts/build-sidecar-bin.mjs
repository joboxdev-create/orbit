// Build the engine sidecar into a single self-contained executable using Node's
// SEA (Single Executable Applications) — cross-platform (Linux / macOS /
// Windows). The binary embeds the Node runtime, so the packaged desktop app
// needs no Node installed.
//
// Output: src-tauri/binaries/orbit-sidecar-<rust-target-triple>[.exe], the name
// Tauri's externalBin expects (it bundles it next to the app as `orbit-sidecar`).
//
// Run from apps/desktop:  node scripts/build-sidecar-bin.mjs
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

// Rust target triple of the current host (matches what Tauri's externalBin wants).
const rustc = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
const triple = rustc.match(/^host:\s*(.+)$/m)?.[1]?.trim();
if (!triple) throw new Error("could not determine the Rust target triple");

const outDir = "src-tauri/binaries";
const binPath = join(outDir, `orbit-sidecar-${triple}${isWin ? ".exe" : ""}`);

mkdirSync(outDir, { recursive: true });
mkdirSync(".sidecar-build", { recursive: true });

console.log("› bundling sidecar (esbuild)…");
await esbuild.build({
  entryPoints: ["sidecar/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: ".sidecar-build/server.cjs",
});

console.log("› generating SEA blob…");
run(process.execPath, ["--experimental-sea-config", "sea-config.json"]);

console.log("› copying Node runtime…");
copyFileSync(process.execPath, binPath);

// The copied Node binary is code-signed on macOS; strip the signature so the
// blob can be injected, then ad-hoc re-sign so it runs on Apple Silicon.
if (isMac) run("codesign", ["--remove-signature", binPath]);

console.log("› injecting blob (postject)…");
await inject(binPath, "NODE_SEA_BLOB", readFileSync(".sidecar-build/sea-prep.blob"), {
  sentinelFuse: FUSE,
  ...(isMac ? { machoSegmentName: "NODE_SEA" } : {}),
});

if (isMac) run("codesign", ["--sign", "-", binPath]);
if (!isWin) chmodSync(binPath, 0o755);

console.log(`✓ built ${binPath}`);

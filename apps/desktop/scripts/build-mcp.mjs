// Bundle the orbit-mcp server into a single runnable file. ESM output so the
// MCP SDK (ESM) stays happy; the CJS workspace packages are converted by
// esbuild at bundle time. SEA self-contained binary is a later packaging step.
//
// Run from apps/desktop:  node scripts/build-mcp.mjs  →  dist-mcp/orbit-mcp.mjs
import { mkdirSync } from "node:fs";
import * as esbuild from "esbuild";

mkdirSync("dist-mcp", { recursive: true });

await esbuild.build({
  entryPoints: ["mcp/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  // import.meta is fine in ESM output; banner shims require() for any CJS dep
  // that calls it after esbuild's interop.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  outfile: "dist-mcp/orbit-mcp.mjs",
});

console.log("› orbit-mcp bundled → dist-mcp/orbit-mcp.mjs");

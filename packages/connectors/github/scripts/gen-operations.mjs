// Generates src/generated/operations.ts from GitHub's official OpenAPI
// description (github/rest-api-description). Build-time only — run with:
//   pnpm --filter @orbit/connector-github gen:operations
//
// We don't ship the multi-MB spec: we distil each operation into a compact
// descriptor (id, topic, method, path, summary, docs, params, request body)
// that feeds the generic Tier-2 API explorer. Re-run when GitHub updates.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_URL =
  "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "generated",
  "operations.ts",
);

/** Resolve a local `#/...` JSON pointer against the spec root. */
function resolveRef(spec, ref) {
  const parts = ref.replace(/^#\//, "").split("/");
  let node = spec;
  for (const raw of parts) {
    const key = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");
    node = node?.[key];
  }
  return node;
}

/** Follow `$ref` (with a cycle guard) until we reach a concrete node. */
function deref(spec, node, seen) {
  let cur = node;
  while (cur && typeof cur === "object" && cur.$ref) {
    if (seen.has(cur.$ref)) return {};
    seen.add(cur.$ref);
    cur = resolveRef(spec, cur.$ref);
  }
  return cur;
}

const clip = (s, n = 140) =>
  typeof s === "string" ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : undefined;

/**
 * Distil a JSON Schema into the few fields the explorer needs, bounded in
 * depth so deeply-nested / cyclic GitHub schemas stay compact (the UI falls
 * back to a raw JSON editor for anything below the first object level).
 */
function compactSchema(spec, schema, depth, seen = new Set()) {
  let s = deref(spec, schema, seen);
  if (!s || typeof s !== "object") return undefined;

  // Collapse a top-level allOf into one shallow object.
  if (Array.isArray(s.allOf)) {
    const merged = { type: "object", properties: {}, required: [] };
    for (const part of s.allOf) {
      const p = deref(spec, part, new Set(seen));
      if (p && typeof p === "object") {
        Object.assign(merged.properties, p.properties ?? {});
        if (Array.isArray(p.required)) merged.required.push(...p.required);
      }
    }
    s = merged;
  }

  const out = {};
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  if (type) out.type = type;
  if (Array.isArray(s.enum)) out.enum = s.enum;
  const desc = clip(s.description);
  if (desc) out.description = desc;

  const isObject = type === "object" || s.properties;
  if (isObject) {
    out.type = "object";
    if (depth > 0 && s.properties) {
      out.properties = {};
      for (const [k, v] of Object.entries(s.properties)) {
        out.properties[k] = compactSchema(spec, v, depth - 1, new Set(seen)) ?? {
          type: "string",
        };
      }
      if (Array.isArray(s.required) && s.required.length) {
        out.required = s.required;
      }
    }
  } else if (type === "array") {
    out.type = "array";
  }
  return out;
}

function compactParam(spec, raw) {
  const p = deref(spec, raw, new Set());
  if (!p || !p.name || !p.in) return null;
  if (p.in === "header") return null; // headers are handled by the connector
  const param = { name: p.name, in: p.in, required: Boolean(p.required) };
  const desc = clip(p.description, 100);
  if (desc) param.description = desc;
  const schema = compactSchema(spec, p.schema, 0);
  if (schema && (schema.type || schema.enum)) param.schema = schema;
  return param;
}

async function main() {
  process.stdout.write(`Fetching ${SPEC_URL}\n`);
  const res = await fetch(SPEC_URL);
  if (!res.ok) throw new Error(`Spec download failed: ${res.status}`);
  const spec = await res.json();

  const operations = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    const sharedParams = item.parameters ?? [];
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!op) continue;

      const params = [...sharedParams, ...(op.parameters ?? [])]
        .map((p) => compactParam(spec, p))
        .filter(Boolean);

      let requestSchema;
      const bodySchema =
        op.requestBody &&
        deref(spec, op.requestBody, new Set())?.content?.["application/json"]
          ?.schema;
      if (bodySchema) requestSchema = compactSchema(spec, bodySchema, 2);

      operations.push({
        id: op.operationId ?? `${method}${path.replace(/\W+/g, "_")}`,
        topic: op.tags?.[0] ?? "other",
        method: method.toUpperCase(),
        path,
        summary: clip(op.summary) ?? op.operationId ?? path,
        ...(op.externalDocs?.url ? { docsUrl: op.externalDocs.url } : {}),
        ...(params.length ? { parameters: params } : {}),
        ...(requestSchema ? { requestSchema } : {}),
      });
    }
  }

  operations.sort(
    (a, b) => a.topic.localeCompare(b.topic) || a.path.localeCompare(b.path),
  );

  const banner =
    "// AUTO-GENERATED by scripts/gen-operations.mjs — DO NOT EDIT.\n" +
    `// Source: ${SPEC_URL}\n` +
    `// Operations: ${operations.length}. Regenerate: pnpm --filter @orbit/connector-github gen:operations\n`;
  const body =
    `import type { ApiOperation } from "@orbit/connector-sdk";\n\n` +
    `export const githubOperations: ApiOperation[] = ${JSON.stringify(
      operations,
      null,
      2,
    )};\n`;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, banner + "\n" + body);
  process.stdout.write(
    `Wrote ${operations.length} operations → ${OUT}\n` +
      `Topics: ${[...new Set(operations.map((o) => o.topic))].length}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`${e.stack ?? e}\n`);
  process.exit(1);
});

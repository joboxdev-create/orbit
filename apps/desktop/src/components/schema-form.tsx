import type { JsonSchema, JsonSchemaProp } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Values = Record<string, unknown>;

/** Initial values from a schema's declared defaults. */
export function defaultsFor(schema?: JsonSchema): Values {
  const out: Values = {};
  for (const [name, def] of Object.entries(schema?.properties ?? {})) {
    if (def.default !== undefined) out[name] = def.default;
  }
  return out;
}

/**
 * Renders a form from a (minimal) JSON Schema — generic over any connector, so
 * we never hand-code per-connector forms. `secret` renders string fields as
 * password inputs (used for the credentials schema).
 */
export function SchemaForm({
  schema,
  values,
  onChange,
  secret = false,
}: {
  schema: JsonSchema;
  values: Values;
  onChange: (next: Values) => void;
  secret?: boolean;
}) {
  const entries = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No fields required.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([name, def]) => (
        <Field
          key={name}
          name={name}
          def={def}
          required={required.has(name)}
          secret={secret}
          value={values[name]}
          onChange={(v) => onChange({ ...values, [name]: v })}
        />
      ))}
    </div>
  );
}

function Field({
  name,
  def,
  required,
  secret,
  value,
  onChange,
}: {
  name: string;
  def: JsonSchemaProp;
  required: boolean;
  secret: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `f-${name}`;
  const labelEl = (
    <Label htmlFor={id}>
      {name}
      {!required && <span className="text-muted-foreground"> (optional)</span>}
    </Label>
  );

  if (def.enum) {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {def.enum.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (def.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {name}
      </label>
    );
  }

  const isNumber = def.type === "number" || def.type === "integer";
  return (
    <div className="space-y-1.5">
      {labelEl}
      <Input
        id={id}
        type={secret ? "password" : isNumber ? "number" : "text"}
        value={value === undefined || value === null ? "" : String(value)}
        placeholder={def.description ?? ""}
        onChange={(e) =>
          onChange(
            isNumber
              ? e.target.value === ""
                ? undefined
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </div>
  );
}

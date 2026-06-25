// Framework-free domain errors. The engine never imports NestJS/HTTP; it throws
// these, and each host maps `kind` to its own transport (the server → HTTP
// exceptions, the desktop → IPC errors).

export type EngineErrorKind =
  | "not_found"
  | "bad_request"
  | "conflict"
  | "forbidden";

export class EngineError extends Error {
  constructor(
    readonly kind: EngineErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export const notFound = (message: string) =>
  new EngineError("not_found", message);
export const badRequest = (message: string) =>
  new EngineError("bad_request", message);
export const conflict = (message: string) =>
  new EngineError("conflict", message);
export const forbidden = (message: string) =>
  new EngineError("forbidden", message);

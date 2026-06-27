// Filesystem adapters — the desktop host's store. They implement the same
// engine ports as the server's Prisma adapters, but over `.orbit/` files
// (no database). The folder is the source of truth, git-style.
export * from "./file-workspace.js";
export * from "./fs-project-repository.js";
export * from "./fs-connector-instance-repository.js";
export * from "./fs-saved-request-repository.js";
export * from "./fs-conversation-repository.js";
export * from "./fs-mcp-server-repository.js";

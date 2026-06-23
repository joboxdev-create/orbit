/** Base URL of the ORBIT core API. Configured via env, never hardcoded. */
export const CORE_API_URL =
  process.env.CORE_API_URL ?? "http://localhost:3001/api";

export interface ConnectorSummary {
  type: string;
  layer: string;
  displayName: string;
  description: string;
  capabilities: number;
  apiOperations: number;
}

/** Fetch registered connectors from the core; tolerate the core being down. */
export async function getConnectors(): Promise<ConnectorSummary[]> {
  try {
    const res = await fetch(`${CORE_API_URL}/connectors`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as ConnectorSummary[];
  } catch {
    return [];
  }
}

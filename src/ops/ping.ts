import type { ApiClient } from "../api-client.js";

export function ping(client: ApiClient): Promise<unknown> {
  return client.get("/diagnostics/ping");
}

import type { ApiClient } from "../api-client.js";
import { paginate } from "../api-helpers.js";

export interface UsersListOpts {
  limit?: number;
  search?: string;
}

export async function usersList(
  client: ApiClient,
  opts: UsersListOpts = {}
): Promise<unknown[]> {
  if (opts.search) {
    const all = await paginate(client, "/users", {}, Infinity);
    const term = opts.search.toLowerCase();
    return (all as Record<string, string>[]).filter((u) => {
      const fields = [u.displayName, u.firstName, u.lastName, u.email];
      return fields.some((f) => f && f.toLowerCase().includes(term));
    });
  }
  return paginate(client, "/users", {}, opts.limit);
}

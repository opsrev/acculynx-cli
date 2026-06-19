import { describe, it, expect, vi, afterEach } from "vitest";
import { usersList } from "./users.js";
import type { ApiClient } from "../api-client.js";

function clientReturning(items: unknown[]): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({ count: items.length, pageSize: 25, pageStartIndex: 0, items }),
    post: vi.fn(),
    postForm: vi.fn(),
  };
}

describe("users op", () => {
  afterEach(() => vi.restoreAllMocks());

  it("usersList without search paginates /users", async () => {
    const client = clientReturning([]);
    await usersList(client, {});
    expect(client.get).toHaveBeenCalledWith(
      "/users",
      expect.objectContaining({ pageSize: "25", pageStartIndex: "0" })
    );
  });

  it("usersList with search filters client-side by name/email", async () => {
    const client = clientReturning([
      { displayName: "Jane Roof", firstName: "Jane", lastName: "Roof", email: "jane@x.com" },
      { displayName: "Bob Gutter", firstName: "Bob", lastName: "Gutter", email: "bob@x.com" },
    ]);
    const result = (await usersList(client, { search: "gutter" })) as Record<string, string>[];
    expect(result).toHaveLength(1);
    expect(result[0].lastName).toBe("Gutter");
  });
});

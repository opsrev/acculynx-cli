import { describe, it, expect, vi, afterEach } from "vitest";
import { Command } from "commander";
import { registerUsersCommands } from "./users.js";
import type { ApiClient } from "../api-client.js";

function setup() {
  const mockClient: ApiClient = {
    get: vi.fn().mockResolvedValue({ count: 2, pageSize: 25, pageStartIndex: 0, items: [
      { id: "u-1", displayName: "Alice Smith", firstName: "Alice", lastName: "Smith", email: "alice@example.com" },
      { id: "u-2", displayName: "Bob Jones", firstName: "Bob", lastName: "Jones", email: "bob@example.com" },
    ] }),
    post: vi.fn(),
    postForm: vi.fn(),
  };
  vi.spyOn(console, "log").mockImplementation(() => {});
  const program = new Command();
  program.exitOverride();
  registerUsersCommands(program, () => mockClient);
  return { mockClient, program };
}

describe("users commands", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("users list calls paginate on /users", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync(["node", "test", "users", "list"]);

    expect(mockClient.get).toHaveBeenCalledWith("/users", expect.objectContaining({
      pageSize: "25",
      pageStartIndex: "0",
    }));
  });

  it("users list outputs JSON array", async () => {
    const { program } = setup();
    const logSpy = vi.spyOn(console, "log");

    await program.parseAsync(["node", "test", "users", "list"]);

    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output).toHaveLength(2);
    expect(output[0].id).toBe("u-1");
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { Command } from "commander";
import { registerContactsCommands } from "./contacts.js";
import type { ApiClient } from "../api-client.js";

function setup() {
  const mockClient: ApiClient = {
    get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
    post: vi.fn().mockResolvedValue({ id: 1 }),
    postForm: vi.fn(),
  };
  vi.spyOn(console, "log").mockImplementation(() => {});
  const program = new Command();
  program.exitOverride();
  registerContactsCommands(program, () => mockClient);
  return { mockClient, program };
}

describe("contacts commands", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("contacts list calls paginate on /contacts", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync(["node", "test", "contacts", "list"]);

    expect(mockClient.get).toHaveBeenCalledWith("/contacts", expect.objectContaining({
      pageSize: "25",
      pageStartIndex: "0",
    }));
  });

  it("contacts get calls GET /contacts/{contactId}", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({ id: "c-1", name: "Jane" });

    await program.parseAsync(["node", "test", "contacts", "get", "c-1"]);

    expect(mockClient.get).toHaveBeenCalledWith("/contacts/c-1");
  });

  it("contacts emails calls GET /contacts/{contactId}/email-addresses", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue([]);

    await program.parseAsync(["node", "test", "contacts", "emails", "c-1"]);

    expect(mockClient.get).toHaveBeenCalledWith("/contacts/c-1/email-addresses");
  });

  it("contacts phones calls GET /contacts/{contactId}/phone-numbers", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue([]);

    await program.parseAsync(["node", "test", "contacts", "phones", "c-1"]);

    expect(mockClient.get).toHaveBeenCalledWith("/contacts/c-1/phone-numbers");
  });
});

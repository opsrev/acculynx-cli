import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { paginate, readStdin } from "../api-helpers.js";

export function registerContactsCommands(
  parentCmd: Command,
  getClient: () => ApiClient
): void {
  const contacts = parentCmd.command("contacts").description("Contact operations");

  contacts
    .command("list")
    .description("List contacts (paginated)")
    .option("--limit <n>", "Max total results (default: 25)")
    .option("--all", "Fetch all results (no limit)")
    .action(async (opts) => {
      const limit = opts.all ? Infinity : opts.limit ? parseInt(opts.limit, 10) : undefined;
      const result = await paginate(getClient(), "/contacts", {}, limit);
      console.log(JSON.stringify(result));
    });

  contacts
    .command("get")
    .argument("<contactId>", "Contact ID")
    .description("Get contact details")
    .action(async (contactId: string) => {
      const result = await getClient().get(`/contacts/${contactId}`);
      console.log(JSON.stringify(result));
    });

  contacts
    .command("create")
    .description("Create a contact (pipe JSON body to stdin)")
    .action(async () => {
      const body = await readStdin();
      const result = await getClient().post("/contacts", body);
      console.log(JSON.stringify(result));
    });

  contacts
    .command("search")
    .description("Search contacts")
    .requiredOption("--query <text>", "Search term (required)")
    .option("--sort-by <field>", "Sort by field (default: LastName)", "LastName")
    .option("--sort-order <order>", "Ascending or Descending (default: Ascending)", "Ascending")
    .action(async (opts) => {
      const result = await getClient().post("/contacts/search", {
        SearchTerm: opts.query,
        SortBy: opts.sortBy,
        SortOrder: opts.sortOrder,
      });
      console.log(JSON.stringify(result));
    });

  contacts
    .command("emails")
    .argument("<contactId>", "Contact ID")
    .description("List contact email addresses")
    .action(async (contactId: string) => {
      const result = await getClient().get(`/contacts/${contactId}/email-addresses`);
      console.log(JSON.stringify(result));
    });

  contacts
    .command("phones")
    .argument("<contactId>", "Contact ID")
    .description("List contact phone numbers")
    .action(async (contactId: string) => {
      const result = await getClient().get(`/contacts/${contactId}/phone-numbers`);
      console.log(JSON.stringify(result));
    });
}

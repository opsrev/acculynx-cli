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
    .option("--limit <n>", "Max total results")
    .action(async (opts) => {
      const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;
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
    .description("Search contacts (pipe JSON search criteria to stdin)")
    .action(async () => {
      const body = await readStdin();
      const result = await getClient().post("/contacts/search", body);
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

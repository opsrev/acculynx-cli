import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { readStdin } from "../api-helpers.js";
import {
  contactsList,
  contactGet,
  contactCreate,
  contactsSearch,
  contactEmails,
  contactPhones,
  contactPhoneAdd,
} from "../ops/contacts.js";

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
      console.log(JSON.stringify(await contactsList(getClient(), limit)));
    });

  contacts
    .command("get")
    .argument("<contactId>", "Contact ID")
    .description("Get contact details")
    .action(async (contactId: string) => {
      console.log(JSON.stringify(await contactGet(getClient(), contactId)));
    });

  contacts
    .command("create")
    .description("Create a contact (pipe JSON body to stdin)")
    .action(async () => {
      const body = await readStdin();
      console.log(JSON.stringify(await contactCreate(getClient(), body)));
    });

  contacts
    .command("search")
    .description("Search contacts")
    .requiredOption("--query <text>", "Search term (required)")
    .requiredOption("--start-date <date>", "Start date (YYYY-MM-DD, required)")
    .requiredOption("--end-date <date>", "End date (YYYY-MM-DD, required)")
    .option("--sort-by <field>", "Sort by: CreatedDate, firstName, lastName", "lastName")
    .option("--sort-order <order>", "Ascending or Descending", "Ascending")
    .action(async (opts) => {
      const result = await contactsSearch(getClient(), {
        query: opts.query,
        startDate: opts.startDate,
        endDate: opts.endDate,
        sortBy: opts.sortBy,
        sortOrder: opts.sortOrder,
      });
      console.log(JSON.stringify(result));
    });

  contacts
    .command("emails")
    .argument("<contactId>", "Contact ID")
    .description("List contact email addresses")
    .action(async (contactId: string) => {
      console.log(JSON.stringify(await contactEmails(getClient(), contactId)));
    });

  contacts
    .command("phones")
    .argument("<contactId>", "Contact ID")
    .description("List contact phone numbers")
    .action(async (contactId: string) => {
      console.log(JSON.stringify(await contactPhones(getClient(), contactId)));
    });

  contacts
    .command("phone-add")
    .argument("<contactId>", "Contact ID")
    .description("Add a phone number to a contact (omit --sms-opt-out to opt in to SMS)")
    .requiredOption("--type <type>", "Phone type: Mobile, Home, Work")
    .requiredOption("--number <number>", "Phone number")
    .option("--sms-opt-out", "Opt this number out of SMS")
    .action(async (contactId: string, opts) => {
      const result = await contactPhoneAdd(getClient(), contactId, {
        type: opts.type,
        number: opts.number,
        smsOptOut: Boolean(opts.smsOptOut),
      });
      console.log(JSON.stringify(result));
    });
}

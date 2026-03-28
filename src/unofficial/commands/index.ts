import type { Command } from "commander";
import { loadSession } from "../session-store.js";
import {
  createUnofficialClient,
  type UnofficialClient,
} from "../unofficial-client.js";
import { registerLoginCommands } from "./login.js";
import { registerDocumentsCommands } from "./documents.js";
import { registerMessagesCommands } from "./messages.js";

function getSessionFromEnv() {
  const email = process.env.ACCULYNX_EMAIL;
  const companyId = process.env.ACCULYNX_COMPANY_ID;
  if (!email || !companyId) {
    throw new Error(
      "Set ACCULYNX_EMAIL and ACCULYNX_COMPANY_ID (or run `acculynx unofficial login` first)"
    );
  }
  const session = loadSession(email, companyId);
  if (!session) {
    throw new Error(
      `No cached session for ${email} / ${companyId}. Run \`acculynx unofficial login\` first.`
    );
  }
  return session;
}

export function registerUnofficialCommands(parentCmd: Command): void {
  const unofficial = parentCmd
    .command("unofficial")
    .description(
      "Unofficial web API commands (cookie-based auth, reverse-engineered)"
    );

  // Login/session commands don't need an active session
  registerLoginCommands(unofficial);

  // Commands that require an authenticated session
  let _client: UnofficialClient | null = null;
  function getClient(): UnofficialClient {
    if (!_client) {
      _client = createUnofficialClient(getSessionFromEnv());
    }
    return _client;
  }

  registerDocumentsCommands(unofficial, getClient);
  registerMessagesCommands(unofficial, getClient);
}

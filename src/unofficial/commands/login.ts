import type { Command } from "commander";
import { login, listCompanies } from "../session.js";
import {
  saveSession,
  deleteSession,
  listSessions,
} from "../session-store.js";

function getCredentials(opts: {
  email?: string;
  password?: string;
  companyId?: string;
}) {
  const email = opts.email ?? process.env.ACCULYNX_EMAIL;
  const password = opts.password ?? process.env.ACCULYNX_PASSWORD;
  const companyId = opts.companyId ?? process.env.ACCULYNX_COMPANY_ID;

  if (!email) {
    throw new Error(
      "Missing email: pass --email or set ACCULYNX_EMAIL"
    );
  }
  if (!password) {
    throw new Error(
      "Missing password: pass --password or set ACCULYNX_PASSWORD"
    );
  }
  if (!companyId) {
    throw new Error(
      "Missing company ID: pass --company-id or set ACCULYNX_COMPANY_ID"
    );
  }

  return { email, password, companyId };
}

export function registerLoginCommands(parentCmd: Command): void {
  parentCmd
    .command("login")
    .description("Authenticate and cache session cookies")
    .option("--email <email>", "AccuLynx email (env: ACCULYNX_EMAIL)")
    .option(
      "--password <password>",
      "AccuLynx password (env: ACCULYNX_PASSWORD)"
    )
    .option(
      "--company-id <id>",
      "Company GUID (env: ACCULYNX_COMPANY_ID)"
    )
    .action(async (opts) => {
      const { email, password, companyId } = getCredentials(opts);
      const session = await login(email, password, companyId);
      saveSession(session);
      console.log(
        JSON.stringify({
          status: "ok",
          email,
          companyId,
          message: "Session cached successfully",
        })
      );
    });

  parentCmd
    .command("companies")
    .description(
      "List available companies for your account (discovers company IDs)"
    )
    .option("--email <email>", "AccuLynx email (env: ACCULYNX_EMAIL)")
    .option(
      "--password <password>",
      "AccuLynx password (env: ACCULYNX_PASSWORD)"
    )
    .action(async (opts) => {
      const email = opts.email ?? process.env.ACCULYNX_EMAIL;
      const password = opts.password ?? process.env.ACCULYNX_PASSWORD;
      if (!email) {
        throw new Error(
          "Missing email: pass --email or set ACCULYNX_EMAIL"
        );
      }
      if (!password) {
        throw new Error(
          "Missing password: pass --password or set ACCULYNX_PASSWORD"
        );
      }
      const companies = await listCompanies(email, password);
      console.log(JSON.stringify(companies));
    });

  parentCmd
    .command("sessions")
    .description("List cached sessions")
    .action(() => {
      const sessions = listSessions();
      console.log(JSON.stringify(sessions));
    });

  parentCmd
    .command("logout")
    .description("Remove a cached session")
    .option("--email <email>", "AccuLynx email (env: ACCULYNX_EMAIL)")
    .option(
      "--company-id <id>",
      "Company GUID (env: ACCULYNX_COMPANY_ID)"
    )
    .action((opts) => {
      const email = opts.email ?? process.env.ACCULYNX_EMAIL;
      const companyId = opts.companyId ?? process.env.ACCULYNX_COMPANY_ID;
      if (!email || !companyId) {
        throw new Error(
          "Both --email and --company-id are required (or set env vars)"
        );
      }
      const removed = deleteSession(email, companyId);
      console.log(
        JSON.stringify({
          status: removed ? "removed" : "not_found",
          email,
          companyId,
        })
      );
    });
}

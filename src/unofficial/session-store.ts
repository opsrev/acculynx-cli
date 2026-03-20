import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { CookieJar } from "./cookie-jar.js";
import type { UnofficialSession } from "./session.js";

const CONFIG_DIR = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
  "acculynx-cli"
);
const SESSIONS_DIR = join(CONFIG_DIR, "sessions");

/** Derive a stable filename from email + companyId. */
function sessionKey(email: string, companyId: string): string {
  const slug = email.replace(/[@.]/g, "-").toLowerCase();
  const prefix = companyId.slice(0, 8);
  return `${slug}--${prefix}.json`;
}

export function loadSession(
  email: string,
  companyId: string
): UnofficialSession | null {
  const file = join(SESSIONS_DIR, sessionKey(email, companyId));
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, "utf-8"));
    return {
      jar: CookieJar.fromJSON(data.cookies),
      companyId: data.companyId,
      email: data.email,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: UnofficialSession): void {
  mkdirSync(SESSIONS_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(SESSIONS_DIR, sessionKey(session.email, session.companyId)),
    JSON.stringify(
      {
        email: session.email,
        companyId: session.companyId,
        cookies: session.jar.toJSON(),
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
}

export function deleteSession(email: string, companyId: string): boolean {
  const file = join(SESSIONS_DIR, sessionKey(email, companyId));
  if (!existsSync(file)) return false;
  unlinkSync(file);
  return true;
}

/** List all cached sessions. */
export function listSessions(): Array<{
  email: string;
  companyId: string;
  file: string;
}> {
  if (!existsSync(SESSIONS_DIR)) return [];
  return readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const data = JSON.parse(
          readFileSync(join(SESSIONS_DIR, f), "utf-8")
        );
        return { email: data.email, companyId: data.companyId, file: f };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{
    email: string;
    companyId: string;
    file: string;
  }>;
}

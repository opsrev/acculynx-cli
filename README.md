# AccuLynx MCP Server & CLI

> npm: [`acculynx-mcp`](https://www.npmjs.com/package/acculynx-mcp) (MCP server) · [`@opsrev/acculynx-cli`](https://www.npmjs.com/package/@opsrev/acculynx-cli) (CLI + MCP)

[![CI](https://github.com/opsrev/acculynx-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/opsrev/acculynx-cli/actions/workflows/ci.yml)

An **MCP server** for the [AccuLynx](https://www.acculynx.com/) roofing CRM —
bring jobs, contacts, and estimates into Claude Desktop, Cursor, or any MCP
client. Every tool is exposed with an enforced JSON Schema, so an AI agent can't
invent a parameter or call a command that doesn't exist.

- **30 tools** across jobs, contacts, estimates, and users.
- **`acculynx-mcp`** — the MCP server, for Claude Desktop / Cursor / any MCP client.
- **`@opsrev/acculynx-cli`** — the same data as a JSON CLI (and it also ships the `acculynx-mcp` server bin).

## Use in Claude Desktop

1. Get an AccuLynx API key (your AccuLynx account administrator creates it under
   **Account Settings → API**).
2. Open your Claude Desktop config file:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
3. Add the server (zero-install via `npx`):

```jsonc
{
  "mcpServers": {
    "acculynx": {
      "command": "npx",
      "args": ["-y", "acculynx-mcp"],
      "env": { "ACCULYNX_API_KEY": "your-api-key" }
    }
  }
}
```

Prefer a global install? Run `npm i -g acculynx-mcp`, then use
`"command": "acculynx-mcp"` with no `args`.

4. Restart Claude Desktop. Open a new chat and ask *"List my 5 most recent
   AccuLynx jobs"* — you should see the `acculynx_*` tools available.

## Use in Cursor / other MCP clients

Any client that speaks MCP over stdio works. Point it at `npx -y acculynx-mcp`
(or a global `acculynx-mcp`) and set `ACCULYNX_API_KEY` in the environment.
Example (Cursor `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "acculynx": {
      "command": "npx",
      "args": ["-y", "acculynx-mcp"],
      "env": { "ACCULYNX_API_KEY": "your-api-key" }
    }
  }
}
```

## MCP tools

All tools are prefixed `acculynx_` and return JSON.

| Tool | Description |
|------|-------------|
| `acculynx_ping` | Health check — verify the API key and connectivity |
| `acculynx_jobs_list` | List jobs (paginated, filterable) |
| `acculynx_jobs_get` | Get one job by id |
| `acculynx_jobs_create` | Create a job |
| `acculynx_jobs_search` | Search jobs by free-text term |
| `acculynx_jobs_contacts` | List a job's contacts |
| `acculynx_jobs_estimates` | List a job's estimates |
| `acculynx_jobs_financials` | Get a job's financials |
| `acculynx_jobs_invoices` | List a job's invoices |
| `acculynx_jobs_milestones` | List a job's milestone history |
| `acculynx_jobs_payments` | List a job's payments |
| `acculynx_jobs_history` | Get a job's change history |
| `acculynx_jobs_reps` | List a job's representatives |
| `acculynx_jobs_reps_assign` | Assign a representative to a job |
| `acculynx_jobs_work_types` | List the company's active work types (id + name) |
| `acculynx_jobs_trade_types` | List the company's active trade types (id + name) |
| `acculynx_jobs_set_work_type` | Set a job's work type — by `workType` name or `workTypeId` |
| `acculynx_jobs_set_trade_types` | Set a job's trade types — by `tradeTypes` names or `tradeTypeIds` (empty array unassigns all) |
| `acculynx_jobs_document_folders` | List the company's document folders |
| `acculynx_jobs_add_expense` | Record an additional expense on a job |
| `acculynx_jobs_upload_document` | Upload a local file to a job |
| `acculynx_contacts_list` | List contacts (paginated) |
| `acculynx_contacts_get` | Get one contact by id |
| `acculynx_contacts_create` | Create a contact |
| `acculynx_contacts_search` | Search contacts within a date range |
| `acculynx_contacts_emails` | List a contact's email addresses |
| `acculynx_contacts_phones` | List a contact's phone numbers |
| `acculynx_contacts_phone_add` | Add a phone number to a contact |
| `acculynx_estimates_list` | List estimates (paginated) |
| `acculynx_estimates_get` | Get one estimate by id |
| `acculynx_estimates_sections` | List an estimate's sections |
| `acculynx_estimates_section` | Get one estimate section |
| `acculynx_estimates_items` | List items in an estimate section |
| `acculynx_users_list` | List users (paginated, optional name/email search) |

## Configuration

| Env Var | Flag | Required | Description |
|---------|------|----------|-------------|
| `ACCULYNX_API_KEY` | `--api-key` | Yes | AccuLynx official API key (Account Settings → API) |
| `ACCULYNX_EMAIL` | — | No | Login email; only for tools that use AccuLynx's web API |
| `ACCULYNX_PASSWORD` | — | No | Login password; only for web-API tools |
| `ACCULYNX_COMPANY_ID` | — | No | Company GUID; only for web-API tools |

## Also a CLI

`@opsrev/acculynx-cli` exposes the same data as a JSON CLI (and bundles the
`acculynx-mcp` server bin). All output is JSON to stdout; errors are
`{"error": "..."}` to stderr with exit code 1.

```bash
npm install -g @opsrev/acculynx-cli

acculynx ping                              # verify API key
acculynx jobs list --limit 5               # 25 results by default; --all to fetch everything
acculynx jobs get <jobId>
acculynx jobs search --query "smith"
acculynx contacts list --limit 10
acculynx estimates get <estimateId>
```

List commands default to **25 results**; use `--limit <n>` or `--all`. Commands
that create resources read a JSON body from stdin:

```bash
echo '{"name": "New Job"}' | acculynx jobs create
```

Pipe to `jq` for scripting:

```bash
JOB_ID=$(acculynx jobs list --limit 1 | jq -r '.[0].id')
acculynx jobs get "$JOB_ID" | jq .
```

## Development

```bash
cp .env.example .env   # fill in your credentials
npm install
npm test               # run unit tests (mocked fetch)
npm run dev -- --help  # run the CLI in dev mode (auto-loads .env)
npm run build          # build both bins to dist/
```

`npm run dev` auto-loads `.env` via Node's `--env-file`:

```bash
npm run dev -- jobs list --limit 5
```

## License

MIT

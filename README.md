# @opsrev/acculynx-cli

[![CI](https://github.com/opsrev/acculynx-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/opsrev/acculynx-cli/actions/workflows/ci.yml)

CLI for the AccuLynx roofing CRM API. Designed for AI agent consumption -- all output is JSON.

## Installation

```bash
npm install -g @opsrev/acculynx-cli
```

## Configuration

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Your `.env` is gitignored and will never be committed.

### Official API

| Env Var | Flag | Description |
|---------|------|-------------|
| `ACCULYNX_API_KEY` | `--api-key` | AccuLynx API key (required) |

API keys are created by your AccuLynx account administrator under Account Settings.

### Unofficial Web API

The `unofficial` commands use cookie-based authentication against AccuLynx's internal web APIs. These provide access to features not available in the official API (job documents, dashboard, etc.).

| Env Var | Flag | Description |
|---------|------|-------------|
| `ACCULYNX_EMAIL` | `--email` | Your AccuLynx login email |
| `ACCULYNX_PASSWORD` | `--password` | Your AccuLynx password |
| `ACCULYNX_COMPANY_ID` | `--company-id` | Company GUID from location selector |

> **Note:** These endpoints are reverse-engineered from the AccuLynx web app and may break without notice.

## Commands

```
acculynx ping                                  # Health check / verify API key
acculynx jobs list [--limit <n>] [--all]         # List jobs (default: 25 results)
acculynx jobs get <jobId>                       # Get job details
acculynx jobs create                            # Create a job (JSON from stdin)
acculynx jobs search --query <text>             # Search jobs
acculynx jobs contacts <jobId>                  # List job contacts
acculynx jobs estimates <jobId>                 # List job estimates
acculynx jobs financials <jobId>                # Get job financials
acculynx jobs invoices <jobId>                  # List job invoices
acculynx jobs milestones <jobId>                # List job milestone history
acculynx jobs payments <jobId>                  # List job payments
acculynx jobs history <jobId>                   # Get job change history
acculynx contacts list [--limit <n>] [--all]    # List contacts (default: 25 results)
acculynx contacts get <contactId>               # Get contact details
acculynx contacts create                        # Create a contact (JSON from stdin)
acculynx contacts search --query <text>         # Search contacts
acculynx contacts emails <contactId>            # List contact email addresses
acculynx contacts phones <contactId>            # List contact phone numbers
acculynx estimates list [--limit <n>] [--all]   # List estimates (default: 25 results)
acculynx estimates get <estimateId>             # Get estimate details
acculynx estimates sections <estimateId>        # List sections for an estimate
acculynx estimates section <estimateId> <secId> # Get section details
acculynx estimates items <estimateId> <secId>   # List items in a section
```

### Unofficial commands

Requires `ACCULYNX_EMAIL`, `ACCULYNX_PASSWORD`, and `ACCULYNX_COMPANY_ID` in your `.env` (or passed as flags).

```
acculynx unofficial companies                          # List available companies (discover your company ID)
acculynx unofficial login                              # Authenticate and cache session
acculynx unofficial logout                             # Remove cached session
acculynx unofficial sessions                           # List cached sessions
acculynx unofficial documents list <jobId>             # List all document folders/files for a job
acculynx unofficial documents download <jobId> <fileId> [--output ./file.pdf]  # Download a document
```

**Getting started:** If you don't know your company ID, run `companies` first -- it logs in and returns all companies available to your account:

```bash
npm run dev -- unofficial companies
# [{"id":"f104ba56-...","name":"My Roofing Co"},{"id":"7749e90f-...","name":"Sandbox"}]
```

Copy the `id` into your `.env` as `ACCULYNX_COMPANY_ID`, then run `login` to cache the session.

Login caches session cookies to `~/.config/acculynx-cli/sessions/` so you only need to re-authenticate when the session expires. Multiple accounts/companies are supported -- each gets its own cached session.

### Pagination

All list commands default to **25 results**. Use `--limit <n>` for a custom count or `--all` to fetch everything:

```bash
acculynx jobs list                  # 25 results (default)
acculynx jobs list --limit 100      # 100 results
acculynx jobs list --all            # all results
```

### Jobs list filters

- `--start-date <YYYY-MM-DD>` -- filter by start date
- `--end-date <YYYY-MM-DD>` -- filter by end date
- `--date-filter-type <type>` -- date field to filter on (default: CreatedDate)
- `--milestones <milestones>` -- filter by milestones
- `--sort-by <field>` -- CreatedDate, MilestoneDate, or ModifiedDate
- `--sort-order <order>` -- Ascending or Descending
- `--includes <fields>` -- contact, initialAppointment

### Search

```bash
acculynx jobs search --query "smith"
acculynx contacts search --query "smith"
acculynx contacts search --query "smith" --sort-by LastName --sort-order Descending
```

### Stdin commands

Commands that create resources accept JSON piped via stdin:

```bash
echo '{"name": "New Job"}' | acculynx jobs create
```

## Output

All output is JSON to stdout. Errors are `{"error": "..."}` to stderr with exit code 1.

```bash
# Pipe to jq for pretty-printing
acculynx jobs list --limit 5 | jq .

# Use in scripts
JOB_ID=$(acculynx jobs list --limit 1 | jq -r '.[0].id')
acculynx jobs get "$JOB_ID" | jq .
```

## Development

```bash
cp .env.example .env  # fill in your credentials
npm install
npm test              # run unit tests
npm run dev -- --help # run in dev mode (auto-loads .env)
npm run build         # build to dist/
./test-integration.sh # run integration tests (requires ACCULYNX_API_KEY)
```

The `npm run dev` script automatically loads your `.env` file via Node's `--env-file` flag (Node 20.6+). Examples:

```bash
npm run dev -- unofficial login
npm run dev -- unofficial documents list <jobId>
npm run dev -- jobs list --limit 5
```

## License

MIT

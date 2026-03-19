# @opsrev/acculynx-cli

[![CI](https://github.com/opsrev/acculynx-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/opsrev/acculynx-cli/actions/workflows/ci.yml)

CLI for the AccuLynx roofing CRM API. Designed for AI agent consumption -- all output is JSON.

## Installation

```bash
npm install -g @opsrev/acculynx-cli
```

## Configuration

Set environment variable or pass flag:

| Env Var | Flag | Description |
|---------|------|-------------|
| `ACCULYNX_API_KEY` | `--api-key` | AccuLynx API key (required) |

API keys are created by your AccuLynx account administrator under Account Settings.

## Commands

```
acculynx ping                                  # Health check / verify API key
acculynx jobs list                              # List jobs (paginated)
acculynx jobs get <jobId>                       # Get job details
acculynx jobs create                            # Create a job (JSON from stdin)
acculynx jobs search                            # Search jobs (JSON from stdin)
acculynx jobs contacts <jobId>                  # List job contacts
acculynx jobs estimates <jobId>                 # List job estimates
acculynx jobs financials <jobId>                # Get job financials
acculynx jobs invoices <jobId>                  # List job invoices
acculynx jobs milestones <jobId>                # List job milestone history
acculynx jobs payments <jobId>                  # List job payments
acculynx jobs history <jobId>                   # Get job change history
acculynx contacts list                          # List contacts (paginated)
acculynx contacts get <contactId>               # Get contact details
acculynx contacts create                        # Create a contact (JSON from stdin)
acculynx contacts search                        # Search contacts (JSON from stdin)
acculynx contacts emails <contactId>            # List contact email addresses
acculynx contacts phones <contactId>            # List contact phone numbers
acculynx estimates list                         # List estimates (paginated)
acculynx estimates get <estimateId>             # Get estimate details
acculynx estimates sections <estimateId>        # List sections for an estimate
acculynx estimates section <estimateId> <secId> # Get section details
acculynx estimates items <estimateId> <secId>   # List items in a section
```

### Jobs list options

- `--start-date <YYYY-MM-DD>` -- filter by start date
- `--end-date <YYYY-MM-DD>` -- filter by end date
- `--date-filter-type <type>` -- date field to filter on (default: CreatedDate)
- `--milestones <milestones>` -- filter by milestones
- `--sort-by <field>` -- CreatedDate, MilestoneDate, or ModifiedDate
- `--sort-order <order>` -- Ascending or Descending
- `--includes <fields>` -- contact, initialAppointment
- `--limit <n>` -- cap total results

### Stdin commands

Commands that create or search accept JSON piped via stdin:

```bash
echo '{"name": "New Job"}' | acculynx jobs create
echo '{"query": "smith"}' | acculynx contacts search
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
npm install
npm test              # run unit tests
npm run dev -- --help # run in dev mode
npm run build         # build to dist/
./test-integration.sh # run integration tests (requires ACCULYNX_API_KEY)
```

## License

MIT

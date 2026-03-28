# AccuLynx CLI

## Quick Reference

- **Stack**: TypeScript, ESM, Commander.js, native fetch
- **Build**: `tsup` -> `dist/`
- **Test**: `vitest` with mocked fetch
- **Dev**: `npx tsx src/index.ts`

## Architecture

- `src/config.ts` -- API key resolution from flag or env var
- `src/api-client.ts` -- authenticated GET/POST requests with Bearer token, 429 retry
- `src/api-helpers.ts` -- pagination helper (pageSize/pageStartIndex), stdin JSON reader
- `src/commands/*.ts` -- one file per domain, each exports a `register*Commands` function
- `src/unofficial/unofficial-client.ts` -- authenticated GET/POST requests with cookie auth, XSRF token support
- `src/unofficial/cookie-jar.ts` -- cookie storage, header generation, individual cookie lookup
- `src/unofficial/session.ts` -- browser-like login flow (form scraping, redirect following)
- `src/unofficial/session-store.ts` -- session persistence to ~/.config/acculynx-cli/sessions/
- `src/unofficial/commands/*.ts` -- unofficial command files (documents, messages, login)
- `src/index.ts` -- CLI entry, wires Commander with all command registrations

## Conventions

- All output: JSON to stdout, errors as `{"error": "..."}` to stderr
- ESM with `.js` extensions in imports
- Tests colocated with source (`*.test.ts`)
- Env var: `ACCULYNX_API_KEY`
- Official POST commands read JSON body from stdin (piped)
- Unofficial POST commands accept arguments/flags directly (no stdin)
- HTML content from unofficial APIs is converted to markdown via `turndown` for AI consumption

## Commits

All commits MUST use [Conventional Commits](https://www.conventionalcommits.org/) format.

Types:
- `feat:` -- new feature
- `fix:` -- bug fix
- `docs:` -- documentation only
- `chore:` -- maintenance, dependencies
- `refactor:` -- code restructuring, no behavior change
- `test:` -- adding/updating tests

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
- `src/index.ts` -- CLI entry, wires Commander with all command registrations

## Conventions

- All output: JSON to stdout, errors as `{"error": "..."}` to stderr
- ESM with `.js` extensions in imports
- Tests colocated with source (`*.test.ts`)
- Env var: `ACCULYNX_API_KEY`
- POST commands read JSON body from stdin (piped)

## Commits

All commits MUST use [Conventional Commits](https://www.conventionalcommits.org/) format.

Types:
- `feat:` -- new feature
- `fix:` -- bug fix
- `docs:` -- documentation only
- `chore:` -- maintenance, dependencies
- `refactor:` -- code restructuring, no behavior change
- `test:` -- adding/updating tests

# Listing the AccuLynx MCP server in directories

The repo ships everything needed to be indexed. The steps below are the
account-based parts that require a maintainer login. Glama and mcp.so crawl
public GitHub repos automatically — once the repo has the `mcp` topic, no
action is needed there.

## 0. Publish the `acculynx-mcp` package (do this first)

The clean install commands (`npx -y acculynx-mcp`, `npm i -g acculynx-mcp`) and
the official-registry entry all reference the `acculynx-mcp` npm package. Publish
it once from `wrapper/`:

```bash
cd wrapper
npm publish --access public      # requires `npm login` as a maintainer
```

It depends on `@opsrev/acculynx-cli` at `^1.12.0`, so it automatically tracks CLI
releases — you only re-publish the wrapper if the wrapper itself changes. Until
this is published, use the already-published combined form:
`npx -y -p @opsrev/acculynx-cli acculynx-mcp`.

## 1. Official MCP registry (registry.modelcontextprotocol.io)

Uses `server.json` at the repo root, which references the `acculynx-mcp` package.
Ownership is verified against the `io.github.opsrev/*` namespace via GitHub auth,
and the published `acculynx-mcp` package must contain a matching `mcpName` field
(it does). Make sure `server.json`'s `version` matches the **currently published**
`acculynx-mcp` version before publishing.

```bash
# install the publisher CLI (see https://github.com/modelcontextprotocol/registry)
brew install mcp-publisher    # or download a release binary

# from the repo root:
mcp-publisher login github     # opens GitHub OAuth for the opsrev org
mcp-publisher publish          # reads ./server.json
```

## 2. Smithery (smithery.ai)

Uses `smithery.yaml` at the repo root (runs `npx -y acculynx-mcp`).

1. Sign in at https://smithery.ai with the GitHub account that owns the repo.
2. "Add Server" -> connect `opsrev/acculynx-cli`.
3. Smithery reads `smithery.yaml`; confirm the config fields (apiKey required).

## 3. Glama (glama.ai) & mcp.so

Both auto-discover public repos that contain an MCP server. No submission
needed — verify the repo is public and has the `mcp` topic. To nudge indexing,
you can submit the repo URL on each site's "add server" page.

## 4. awesome-mcp-servers (GitHub list)

Open a PR to https://github.com/punkpeye/awesome-mcp-servers adding this entry
under the appropriate category (e.g. "Other Tools and Integrations"):

```markdown
- [acculynx-mcp](https://github.com/opsrev/acculynx-cli) 📇 ☁️ - AccuLynx roofing CRM (jobs, contacts, estimates) for Claude Desktop, Cursor, and any MCP client.
```

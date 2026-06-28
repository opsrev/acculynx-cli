#!/usr/bin/env node
// Thin launcher: boots the AccuLynx MCP stdio server from @opsrev/acculynx-cli.
// Kept as a single-bin package so `npx acculynx-mcp` and the official MCP
// registry can run it unambiguously (the CLI package ships two bins).
import "@opsrev/acculynx-cli/dist/mcp.js";

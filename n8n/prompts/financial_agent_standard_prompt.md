# Historical prompt location

The laboratory no longer loads a separate prompt for the old individual HTTP tools.
Its current English system prompt is composed from:

1. `n8n/prompts/tool_error_policy.md` (priority evidence and retry rules).
2. `n8n/mcp/assistant-prompt.md` (role, language, business behavior and MCP contract).

`n8n/scripts/build-channel-laboratory.mjs` assembles both into the AI Agent system message. Edit those source files and regenerate the workflow specification; do not restore the retired tool names from older workflow exports.

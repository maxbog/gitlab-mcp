# Source review: Pi built-in MCP and session lifecycle

Reviewed 2026-10-10:
- [Built-in MCP integration](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/extensions/mcp/index.ts)
- [MCP runtime / transports](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/extensions/mcp/runtime.ts)
- [MCP tool wrapping](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/extensions/mcp/tools.ts)
- [Session manager](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)
- [Extension API types](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)
- [Extension documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [Built-in MCP documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md)

## Verified source observations

1. Built-in MCP creates an `McpClient` in `runtime.ts` and implements transport, connection and tool discovery; in the reviewed path no `elicitation/create` request handler was registered. This supports the working assumption that built-in MCP cannot presently satisfy GitLab's nested approval flow. **Check the exact user's installed Pi 1.x commit** before implementing; absence from this reviewed path is not a proof about every version.
2. Built-in MCP connects registered servers, exposes tool calls through direct/deferred/codemode surfaces, and tool calls pass Pi's tool event pipeline (`tool_call`, `tool_result`), per `index.ts`.
3. Pi supports custom, model-invisible session entries via `pi.appendEntry(customType, data)`; the session manager records a parent-linked tree and `ctx.sessionManager.getBranch()` returns the current session-tree lineage. Distinguish **Pi conversation-tree branches** from **Git repository branches**.
4. Session and tree navigation produce lifecycle events; a permission extension must rebuild projected state after resume/tree/fork, not merely retain an in-memory map.
5. Extension context provides `ctx.signal` during active operations, but may not during idle/commands. Cancellation must be correlated to the tool/elicitation call, not inferred from an arbitrary UI signal.
6. Pi's built-in MCP is superseded when an installed extension claims `/mcp`, per MCP docs. Running both competing MCP managers against the same writable server must be prevented.

## Design consequence

MVP should target **pi-mcp-adapter with a small reviewed API addition** (or an equivalent supported official built-in hook if Pi adds one); not a patched Pi executable and not a second hidden MCP connection. Grant storage should use a separate custom-entry type `pi-permissions/grant-v1`, never the adapter's private `mcp-approval-v1` as a public contract. Strong session reconciliation, context identity, and fail-closed persistence are requirements.

## Unresolved/source-verification tasks

- Determine exact installed Pi / adapter versions and whether upstream has acquired elicitation since inspection.
- Determine whether wrapper `tool_result` can establish actual MCP success, including `isError` and `structuredContent`, for **all** proxy/direct/codemode paths; likely needs adapter-level outcome hook.
- Verify resume/fork/switch order and whether failed `appendEntry` may already be durable; upstream [issue #6679](https://github.com/earendil-works/pi/issues/6679) discusses ambiguity.
- Determine safe handling for ephemeral/no-session/headless and any `getSessionId()` reuse across forks.

**Verdict:** Pi session store is the natural place for grants, but only a carefully bounded adapter interception path can turn stored grants into safe replies to server-initiated elicitation.

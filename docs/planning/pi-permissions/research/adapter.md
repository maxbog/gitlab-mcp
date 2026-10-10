# Source review: pi-mcp-adapter

Reviewed 2026-10-10 (upstream `nicobailon/pi-mcp-adapter`):
- [MCP elicitation handler](https://github.com/nicobailon/pi-mcp-adapter/blob/main/elicitation-handler.ts)
- [Session approval storage](https://github.com/nicobailon/pi-mcp-adapter/blob/main/session-approvals.ts)
- [Consent manager](https://github.com/nicobailon/pi-mcp-adapter/blob/main/consent-manager.ts)
- [Extension initialization and lifecycle](https://github.com/nicobailon/pi-mcp-adapter/blob/main/index.ts)
- [Runtime protocol mediation](https://github.com/nicobailon/pi-mcp-adapter/blob/main/runtime-protocol.ts)
- [Prompts and elicitation docs](https://github.com/nicobailon/pi-mcp-adapter/blob/main/docs/prompts-and-ui.md)
- [Extension API](https://github.com/nicobailon/pi-mcp-adapter/blob/main/docs/extension-api.md)
- [Tool approval documentation](https://github.com/nicobailon/pi-mcp-adapter/blob/main/docs/tools.md)

## Confirmed

1. The adapter registers an MCP `elicitation/create` handler with `client.setRequestHandler`; supports form UI with validate/edit/accept/decline/cancel, URL mode, and pauses the tool request timeout while users answer.
2. Generic tool-level external brokers already exist: `pi-mcp-adapter:tool-approval-request` with a synchronous claim, asynchronous decision, and `allow_once|allow_for_session|deny|abstain`. This is **pre-tool consent**, not interception of a nested `elicitation/create` originating from a server; it cannot alone replace a GitLab server's own prompt without duplicate consent.
3. Adapter's `session-approvals.ts` persists `mcp-approval-v1` custom entries using a tool name + definition hash + argument hash. It restores from `sessionManager.getBranch()` on session events. These entries are adapter-owned; semantic branch/MR approval requires a **separate public protocol**, not undocumented mutation of adapter internals.
4. Elicitation handler advertises support only with dialog-capable UI; headless must default deny.
5. `runtime-protocol.ts` publicly mediates selected additional methods, but does not by itself promise third-party interception of the handler for the core `elicitation/create` method. New public event or hook is required unless a current stable extension API is discovered.
6. Adapter owns many MCP call origins: proxy, direct, `mcpScript`, runtime tool calls, UI iframe, and resource access. A design that checks only Pi's `tool_call` event misses some origin paths.
7. `session-approvals.ts` updates its in-memory map before invoking its persistence callback; the new security-critical grant store must not treat a persistence failure as a successful grant.

## Recommended integration

Publish a small versioned public adapter hook **before** the ordinary elicitation UI:
`pi-mcp-adapter:elicitation-authorization:v1`.

The event carries trustworthy connection identity and current call correlation from the adapter, raw nested request (including namespaced `_meta`), abort signal, and an atomic `claim(handler)`. Only configured/trusted authorization servers may be claimed. The callback returns a well-defined `respond({action,content})` or `pass`; any malformed/error/timeout returns `cancel` (no auto-allow). Unrecognized ordinary forms continue into the existing adapter UI. **No public hook currently verified**: implement and upstream/maintain as a narrow patch, with conformance tests.

## Risks and tasks

- Verify metadata survives server SDK and client SDK routing, and whether `relatedRequestId` can be recovered in the adapter handler. This is a blocking spike.
- Guarantee correlation for concurrent calls and per-connection identity, not only server display name.
- Provide a post-result outcome hook to persist sticky grants only after MCP execution succeeds, including nested `mcpScript` calls.
- Preserve ordinary elicitation, error semantics, timeout pausing, URL mode and other plugins.
- Pin adapter version/API before implementation; package page reported 5.2.0 on 2026-10-09, but package registry status is not a compatibility test.

**Verdict:** extend the adapter through a small public approval-elicitation hook rather than fork/rewrite Pi MCP for MVP.

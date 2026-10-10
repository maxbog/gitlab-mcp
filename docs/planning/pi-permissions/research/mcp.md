# Protocol research: MCP elicitation

Reviewed 2026-10-10:
- [MCP specification, elicitation, 2026-07-28](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/client/elicitation.mdx)
- [Earlier 2025-06-18 elicitation specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/client/elicitation.mdx)

## Protocol facts

- Elicitation allows a server to ask the client for structured user input during processing of a client request; `form` is structured, `url` is for external sensitive workflows.
- Form schemas are a restricted, flat primitive subset of JSON Schema. Do not plan nested user input fields or assume arbitrary schema features work.
- Reply has `action: accept | decline | cancel`; accepted forms include `content`. Both client and server should validate data. A missing or malformed answer cannot count as consent.
- Server capability and client capability negotiation matter; clients must clearly identify the requesting server, and unsupported/headless paths must not silently allow.
- Credentials, tokens and payment secrets must not be solicited through form elicitation.
- Elicitation is nested within an originating client request. The design must respect request association, cancellation, and streaming transports; not all stateless HTTP modes can support this.

## Proposed extension convention — NOT yet standard

Use an optional namespaced request `_meta["dev.maxbog/pi-permissions"]` carrying a **versioned authorization intent** alongside an otherwise valid MCP form. It is a private extension convention and must not be claimed as part of the standard. Determine actual SDK round-trip behavior before committing to this serialization: some SDKs may drop or transform extra metadata.

The standard form must still be sufficient to obtain a human one-shot approval from a client lacking our extension. The Pi semantic-scoping UI is **client-local**; the GitLab server never receives or stores a multi-call sticky grant. Unknown metadata, unknown version and unknown host go to ordinary human form/deny; they cannot trigger auto-accept.

## Exact unresolved interoperability gate

Verify in an actual Pi + adapter + MCP server integration test that:
1. Request `_meta` is transported intact.
2. The active originating MCP tool call/connection can be cryptographically unnecessary but **trustworthily** correlated inside the adapter (a model-provided field is not sufficient).
3. A cancel/timeout causes GitLab mutation to stop, or at minimum blocks an operation before side effects begin.
4. No unrelated elicitation form can consume or impersonate a stored authorization.

If any of these fail, ship manual per-call approval only until a safe hook is available.

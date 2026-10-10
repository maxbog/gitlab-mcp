# Pi Permissions architecture — ADR bundle v1

Status: **proposed for implementation**, pending compatibility gates G0–G4. Reviewed 2026-10-10. Planning only.

## Goals and non-goals

Provide minimal-friction human authorization for trusted MCP mutations from Pi 1.x, while letting the model read freely under an independent MCP read-only policy and keeping write credentials out of the agent sandbox. Goals: per-call approval; per-Pi-session grants scoped by operation + GitLab instance + principal + project + exact branch/MR/issue; revoke; reconnect/resume; safe cancellation; no arbitrary paths denylist; automation-friendly audit and CI. The permission extension MUST NOT replace OS sandboxing or GitLab permissions.

## Architecture decision

**One-way authority:** MCP creates authoritative per-call intents from actual tool arguments; Pi owns and matches scoped user approvals; MCP never caches multi-call grants. A Pi grant is a client policy, not a token granting extra server capability. On every approved/reused call the MCP server still performs its own policy checks, makes a nested elicitation request, checks a fresh reply, and only then calls GitLab.

~~~mermaid
flowchart LR
    User[Human / Pi UI] --> PE[pi-permissions extension]
    Agent[Model + codemode] --> PT[Pi tool runtime]
    PT --> Adapter[pi-mcp-adapter MCP runtime]
    PE <-->|public approval hook + outcome| Adapter
    PE <-->|appendEntry / getBranch| Store[Pi session JSONL tree]
    Adapter <-->|tools/call and elicitation/create| GM[GitLab MCP ask mode]
    GM --> Classifier[GitLab exact mutation classifier]
    Classifier --> Gate[Per-call authorization]
    Gate --> API[GitLab HTTP API]
    Sandbox[Agent sandbox] -.-|No PAT / no writable MCP server process| API
~~~

### Components

**GitLab MCP (server, trusted execution process):**
- Enforce permission mode, allowlist, project restrictions and GitLab PAT account scopes *before* considering an approval.
- Resolve canonical instance, actor, project, resource and operation effects; do not infer from descriptive tool annotations alone.
- Only if write is requested: classify exact operation; emit one nested form elicitation with a namespaced, validated authorization intent and bounded human-readable preview.
- Accept exactly one call after a valid fresh accepted form; store no sticky state. Reject unknown/malformed/version-mismatched replies, cancellation and errors.
- Abort/rollback where possible; never dispatch API mutation if cancellation occurred before dispatch. Unknown completion is not positive success.
- Refuse sticky eligibility for unclassified effects, GraphQL, deletion/admin, quick-action comments, path moves, chmod, force pushes and mixed actions until explicitly reviewed.

**pi-mcp-adapter (trusted client transport):**
- Own MCP connection, capability advertisement, nested handler, request deadlines and origin provenance.
- Expose small public versioned authorization hook prior to normal elicitation UI and a final tool-outcome callback. Pass **transport-verified** server identity and actual pending tool identity, not model-provided ids.
- If no plugin claims request: existing human form path remains unchanged. Never auto accept unknown elicitation, URL mode or untrusted server.
- Handle proxy, direct, codemode/mcpScript, runtime calls and iframe origins consistently; bind all pending permissions to the specific Pi session generation and current tool call.

**pi-permissions (separate Pi extension):**
- Maintain a trusted configured-server allowlist and a separate semantic policy store.
- On eligible nested authorization intent: validate shape, version, origin and tool-call correlation. Match active grant or show explicit UI with only scope options permitted for that exact operation.
- Respond to server using **one-shot acceptance only**. A scope such as 'allow on this branch for session' remains invisible to the server; only Pi stores it.
- Persist selected multi-call grant only when linked MCP call returns confirmed successful outcome, and invalidate pending decision on epoch change, branch-tree navigation, revoke, disconnect or abort.
- List / inspect / revoke grants. Default deny in headless/noninteractive mode; optional preconfiguration of narrowly whitelisted automation is a separate post-MVP decision.

**Pi session store:**
- Append immutable event records `pi-permissions/grant-v1` and `pi-permissions/revoke-v1`; fold lineage from `ctx.sessionManager.getBranch()`; bind to the stable Pi session ID. Do not modify adapter private `mcp-approval-v1` records.
- Resuming the SAME session should restore approvals; a NEW or FORKED session should not inherit them by default. Tree navigation restores only entries in the selected lineage. Revocation on a sibling branch does not rewrite previous history; UI must surface this and optionally support session-global revocation through an independently secured store, deferred beyond MVP.

**Agent sandbox and PAT custody:**
- Pi host and broker outside sandbox; model tool bash runs inside sandbox and cannot read session JSONL / env credentials / Pi MCP connection transport/socket / API token. GitLab PAT only in MCP process or protected OS credential provider. Strong GitLab least privilege/protected branches remain independent defenses.
- Without this boundary, approvals can be forged by editing session files or opening a new MCP client, so security claims become only advisory.

## Grant scopes (v1)

| UI choice | Stored? | Granularity | Default eligible |
|---|---|---|---|
| Deny | No | current call | all |
| Allow once | No | exact current call | all classified mutations |
| Allow matching operation with this tool for session | Yes, on success | server/actor/project/resource/operation/**tool** | allowlisted non-destructive |
| Allow matching operation on this resource for session | Yes, on success | server/actor/project/resource/operation, across approved equivalent tools | exact branch, MR, issue where classifier proves equivalence |

Clarification: "session" means **Pi session** (including resume), not network connection and not elapsed 30 minutes. "branch" in resource scope means **Git branch**; persistence's branch is the **Pi conversation tree**. Permanent cross-session / repo-wide wildcard approval intentionally deferred. When scope covers an entire Git branch, preview explicitly warns it includes CI/config files; no magic 'safePath' exemption.

### Operation taxonomy

- `file.create_update` with branch and effect footprints; separate restrictions for exact file/path-prefix vs whole branch if path scopes are enabled; no mixed deletes.
- `mr.note.add`, `mr.metadata.edit` (only title/description, not state/target/source/merge).
- `issue.create`, `issue.note.add`, `issue.metadata.edit` with fields allowlisted; no quick actions/transition side effects.
- `opaque.write`, `delete`, `admin`, `graphql.mutation`, `force`, `move`, `chmod`: once only until separately reviewed.

## Flows

### F1 — First approval

1. Model calls a tool through Pi; adapter records connection epoch, trusted server config hash, call ID, originating Pi session and exact arguments.
2. GitLab server validates server policy and actor/project identity, normalizes effects and submits nested elicitation (standard form + versioned intent in `_meta`).
3. Adapter routes to claimed permission hook with verified origin and correlation. Plugin compares request fingerprint/intent to **pending actual call**. Mismatch => ordinary human form or deny, never automatic.
4. Pi UI displays exact operation, server/instance, actor, project, target resource, preview and allowed scopes. Human selects deny/once/tool-session/resource-session.
5. Plugin returns one-shot accept to MCP; server validates schema, origin request and timely nonce; dispatches GitLab mutation.
6. Adapter receives final outcome. If confirmed successful, matching session grant selection is atomically persisted; otherwise no grant. Missing persistence confirmation MUST NOT leave an active in-memory grant.

### F2 — Grant reuse

For a later call with same canonical instance+actor+project+resource+operation under the same Pi session lineage, server **still asks**. Adapter forwards new intent; plugin validates and compares; if match, plugin returns one-shot acceptance without UI. Server enforces independently. A different branch, MR, project, instance, identity, operation or special-effect flag causes fresh approval.

### F3 — Revoke or tree switch during a pending call

Every prompt captures generation/epoch and linked tool call identity. A tree switch, session switch, revoke or abort increments epoch and invalidates approval in progress; the adapter MUST not send late positive response. If the server has already passed authorization and started a mutation, abort transport does not guarantee side effects can be undone; show an outcome 'unknown' and don't cache a grant. Where available, propagate AbortSignal all the way to GitLab HTTP client and guard before dispatch.

### F4 — MCP reconnect

MCP server loses all its local approval data (none exists); Pi has branch-derived grants. After reconnect, re-validate server identity/fingerprint, actor, policy version and transport trust. No automatic reuse if any identity changes. A matching request can reuse the Pi grant.

### F5 — Legacy/non-Pi client

Server still offers normal MCP one-shot form approval; client lacking elicitation receives read operations but mutation fails closed. No dependency on Pi-specific extension at server execution time.

## Architecture decision records

**ADR-01 Storage owner:** Pi custom session entries; reject server-owned sticky manager and connection-lifetime grants.

**ADR-02 MCP strategy:** Use pi-mcp-adapter with narrowly designed public elicitation/outcome hook for MVP; do not fork whole Pi. Conditional alternative: Pi built-in supports identical hook and capability in a future release. Gate G0 decides the exact seam.

**ADR-03 Metadata:** Structured, versioned namespaced `_meta` is a proposed interoperability convention; not an MCP standard, and SDK transport preservation is unverified until G0.

**ADR-04 Fallback:** Unknown intent => normal human per-call prompt/deny; never generic auto-accept or heuristic parsing of free-text descriptions.

**ADR-05 TTL:** Pi session lifetime, no artificial TTL. Optional explicit expiration/persistence belongs to a future enhancement and cannot be added silently.

**ADR-06 Protected resources:** GitLab ACLs and protected branches remain authoritative; host policy can further disallow broad approval on default/protected branches. Arbitrary `safePath` file-name denylist rejected.

**ADR-07 Grant commit:** selection is provisional until the **actual** linked call completes successfully. Treat persistence failure and unknown tool result as no grant.

## Open blockers / gates

G0: Does current server SDK carry authorization `_meta` to adapter, and is original call reliably correlated? If not, build minimal adapter hook and/or versioned correlated subprotocol; no auto mode until proven.

G1: Public adapter hook must be upstreamable and cover call origins; prior approval broker is not enough for nested elicitation.

G2: Cancelled server operations must not unexpectedly write *after cancellation is acknowledged as final*. Need abort-aware GitLab client or an honest unknown-outcome guarantee; exact strong semantics need investigation.

G3: Inventory all mutation handlers including GraphQL, quick-actions, multiple resource writes. Unclassified effects are once-only or deny.

G4: Sandboxed model must not access Pi host stores, write PAT, transport process, or trusted hooks. Independently verify in deployment.

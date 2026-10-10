# Implementation backlog — Pi Permissions

Status: **implementation-ready planning draft, not implementation**. Date: 2026-10-10. Created from code/documentation research in this directory. No subagents actually launched in this ChatGPT session; prospective owners below are planning assignments, not execution receipts.

## Operating rules

- Each ticket maps to a **unique prospective specialist agent AG-PP-xxx**. Its scope is defined here; it must first read the relevant source and the research/ reports, collaborate with named peer reviewers, and may propose a new ticket through AGENT-COORDINATION.md. Coordinator integrates all proposed changes.
- Dependencies are implementation prerequisites unless explicitly marked research-only. Do not move to silent automatic reuse before gates G0–G4; if a gate fails, continue only with standard manual per-call ask.
- Every ticket output later includes one small PR or documented research report, exact source paths, tests and updated ADR where relevant. Never claim an agent executed work without a real execution record.
- Contract/authorization changes need explicit cross-domain reviews; GitLab lead owns effect truth, adapter lead owns transport truth, Pi lead owns grant state, security lead can veto widening.
- For each ticket: sizing S = small, M = medium, L = large and not a promise of time. Prospective peer review names use P (Pi), A (adapter), G (GitLab), S (security), T (tests), D (docs).
- Ticket order should respect graph; E0 analysis and E1 semantics can run in parallel, but protocol-dependent implementation must wait for G0. No new global/permanent credentials or blanket approval.
- Linkage to design sources: [architecture](ARCHITECTURE.md), [contract](CONTRACT.md), [storage](STORAGE.md), [security](SECURITY.md), [test plan](TEST-PLAN.md), [coordination](AGENT-COORDINATION.md) and [research](research/).

## Summary and recommended waves

| Epic | Tickets | Direction |
|---|---:|---|
| E0 Feasibility, trust boundaries and architecture | 4 | Prove safe integration and inventory effects before coding. |
| E1 Versioned semantics and authorization contract | 5 | Canonical source identity, operation taxonomy and conservative eligibility. |
| E2 Pi-owned scoped grant engine | 6 | Session event store, matching, UI, revocation and durable success-only commit. |
| E3 pi-mcp-adapter interoperability | 5 | Public nested elicitation interception, trusted correlation, outcomes, fallback. |
| E4 GitLab MCP stateless consent and mutation guards | 5 | Make server per-call enforcement authoritative; remove server-side sticky state. |
| E5 Security hardening and operational isolation | 3 | Protect credentials and state, classify uncertainty, fuzz grant widening. |
| E6 Integration, CI, docs and release | 5 | Prove full end-to-end behavior, migrate existing PR stack, document all limits. |

**Wave 0 — parallel research:** PP-001, PP-003, PP-004. **Wave 1 — architecture and semantic contract:** PP-002, PP-101 through PP-105. **Wave 2 — components:** PP-201–203 and PP-301–303 alongside PP-401–404. **Wave 3 — integration:** dependent Pi state, UI, HTTP, sandbox, harness and negative tests. **Wave 4 — release:** CI, migration docs, independent sign-off.

## Tickets

### E0 — Feasibility, trust boundaries and architecture

Prove safe integration and inventory effects before coding.

#### PP-001 — Validate nested MCP elicitation, metadata and call correlation

**Prospective agent:** AG-PP-001 (unique). **Size:** L. **Depends on:** none. **Cross-review:** A+G+S.

**Design and implementation scope:** Build a throwaway minimal GitLab-MCP-like server, current Pi 1.x client, and adapter. Verify server-side elicitInput and client-side handler receive namespaced request _meta intact; test relatedRequestId, concurrency, abort and stdio / sessionful HTTP. Compare against built-in Pi implementation. Pin exact working versions; no authz shortcut if metadata/correlation is unavailable.

**Acceptance / Definition of Done:** Publish signed-off G0 capability matrix with source lines and runnable fixtures; list precise API gap and smallest patch. Invalid/missing metadata yields only human one-shot consent or denied mutation.

**Required tests and failure cases:** Parallel A/B requests, malformed metadata, request cancellation, unsupported/headless client.

**Source targets / report:** Pi extensions/mcp/runtime.ts; adapter elicitation-handler.ts; MCP SDK docs. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-002 — Select supported MCP integration seam and upstream strategy

**Prospective agent:** AG-PP-002 (unique). **Size:** M. **Depends on:** PP-001. **Cross-review:** A+P.

**Design and implementation scope:** Compare three architectures: extend adapter with public nested elicitation hook, add Pi built-in MCP handler, or own custom transport. Prefer narrow adapter hook for MVP unless G0 disproves feasibility. Define minimum Pi and adapter versions, feature negotiation and rollback.

**Acceptance / Definition of Done:** Accepted ADR names integration owner, exact version bounds, no duplicate /mcp manager or parallel privileged connection, and read-only safe fallback.

**Required tests and failure cases:** Run compatibility smoke test for installed Pi 1.0/1.1 and candidate adapter, with and without extension.

**Source targets / report:** ARCHITECTURE.md; adapter index.ts; Pi mcp docs. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-003 — Inventory every GitLab mutation and effect surface

**Prospective agent:** AG-PP-003 (unique). **Size:** L. **Depends on:** none. **Cross-review:** G+S+T.

**Design and implementation scope:** Read all registered GitLab MCP tools, capability tags, handlers and API endpoints on PR #2 head. Create machine-readable inventory of read/write/delete/admin, hidden compound effects, GraphQL, file modes, quick actions, retries, multi-project calls and exposed transport. Map each to exact effect footprint and sticky eligibility.

**Acceptance / Definition of Done:** Every tool in registry has reviewed capability classification; unknown mutation fails once-only/deny; two reviewers check suspicious special cases. Publish inventory with source and test-fixture links.

**Required tests and failure cases:** Snapshot registry; fail CI if mutation tool added without inventory entry; destructive counterexamples.

**Source targets / report:** src/tools/gitlab.ts; src/lib/tool-capabilities.ts; tool registry tests. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-004 — Prove host/sandbox credential isolation and threat assumptions

**Prospective agent:** AG-PP-004 (unique). **Size:** L. **Depends on:** none. **Cross-review:** S+P.

**Design and implementation scope:** Build a deployment proof of concept using intended Pi sandbox: model shell lacks GitLab PAT, Pi session JSONL and writable MCP socket/process credentials. Check codemode, worktrees, subprocesses, env, volume mounts and project-supplied MCP configs. Document a reproducible secure launch recipe and test commands.

**Acceptance / Definition of Done:** Documented G4 security boundary passes sandbox escape attempts; if not feasible, MVP is explicitly only advisory and silent consent disabled.

**Required tests and failure cases:** Attempt raw curl/glab/GitLab SDK, arbitrary MCP client connection, file and /proc reads, session-record mutation.

**Source targets / report:** SECURITY.md; deployment docs; Pi sandbox settings. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.


### E1 — Versioned semantics and authorization contract

Canonical source identity, operation taxonomy and conservative eligibility.

#### PP-101 — Define versioned authorization intent and schema fixtures

**Prospective agent:** AG-PP-101 (unique). **Size:** M. **Depends on:** PP-001, PP-003. **Cross-review:** A+G+S.

**Design and implementation scope:** Formalize v1 private _meta namespace with standardized primitive form fallback. Define operation, complete effects array, flags, nonce, revision, verified resource and opaque/write risk tags. Distinguish non-authoritative display from authorization fields; impose strict max sizes and no sensitive contents.

**Acceptance / Definition of Done:** Canonical JSON fixtures and validators exist for valid, unknown version, duplicate field, missing/extra risk-bearing fields; fallback never auto-accepts. Human-only non-Pi clients remain compatible.

**Required tests and failure cases:** Schema tests with malicious payloads, unknown enums, oversized batch/preview, code-injection text.

**Source targets / report:** CONTRACT.md; GitLab src/lib/elicitation.ts; adapter elicitation-handler.ts. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-102 — Canonicalize GitLab instance, actor, project and resource identity

**Prospective agent:** AG-PP-102 (unique). **Size:** L. **Depends on:** PP-003. **Cross-review:** G+S+P.

**Design and implementation scope:** Resolve origin and effective authenticated principal via GitLab server request auth context; canonicalize numeric project IDs including project path aliases; bind MR/issue IID to project, branch exact ref to project. Include source server config hash and policy version. Never trust project display name or client-supplied actor.

**Acceptance / Definition of Done:** Identical alias same ID may match; same string on different instance, actor or project cannot match; unavailable identity precludes sticky. Define behavior for token/account rotation and per-request auth HTTP.

**Required tests and failure cases:** Cross-instance, multi-principal HTTP, alias, rename, percent-encoded/ref path tests.

**Source targets / report:** src/lib/auth-context.ts; src/lib/gitlab-client.ts; gitlab-path.ts. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-103 — Normalize safe GitLab mutations into stable operation taxonomy

**Prospective agent:** AG-PP-103 (unique). **Size:** L. **Depends on:** PP-003, PP-101, PP-102. **Cross-review:** G+S+T.

**Design and implementation scope:** Implement pure classifier matching audited tools only: file.create_update; mr.note.add; mr.metadata.edit; issue.create, issue.note.add, issue.metadata.edit. Distinguish tool-specific operation from semantically equivalent resource operation, and include every affected file/field. No regex-based inference from tool description.

**Acceptance / Definition of Done:** Classifier is total and conservative; every supported tool has exact operation fixture and changes outside allowlist downgrade to once-only.

**Required tests and failure cases:** Property/mutation tests and tool equivalence matrix; mixed batch/empty batch/ambiguous flags rejected.

**Source targets / report:** src/lib/elicitation.ts; tools/gitlab.ts; classifier tests. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-104 — Exclude hidden GitLab side effects and dangerous syntax

**Prospective agent:** AG-PP-104 (unique). **Size:** L. **Depends on:** PP-003, PP-103. **Cross-review:** S+G+T.

**Design and implementation scope:** Handle GraphQL nested aliases, multiple mutations, GitLab slash/quick actions (/close, /merge, /rebase), editing file executable bit with either true or false, branch start/force, rename/move/target retarget and mixed batch mutations. Decide once-only vs hard-deny per risk.

**Acceptance / Definition of Done:** None of these paths ever match a benign sticky operation; GraphQL cannot be disguised as read; approval previews state true effect class.

**Required tests and failure cases:** GraphQL alias/fuzz, note quick-action, chmod:false, force, path normalization and complex batch negative tests.

**Source targets / report:** src/tools/gitlab.ts; src/lib/elicitation.ts; graphql-guard tests. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-105 — Version, negotiate and evolve the authorization contract

**Prospective agent:** AG-PP-105 (unique). **Size:** S. **Depends on:** PP-101, PP-102, PP-103. **Cross-review:** A+P+G.

**Design and implementation scope:** Specify policyRevision invalidation, unknown-version downgrade, flags compatibility, duplicate-event replay handling, server capability advertisement and per-request schema safety. Include fixture change process and migration constraints.

**Acceptance / Definition of Done:** Compatibility matrix documents supported versions and client fallback; old grants not reusable after semantic expansion.

**Required tests and failure cases:** Contract schema cross-version fixtures; runtime negotiation test.

**Source targets / report:** CONTRACT.md; protocol fixtures; adapter and server validation. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.


### E2 — Pi-owned scoped grant engine

Session event store, matching, UI, revocation and durable success-only commit.

#### PP-201 — Implement Pi grant event model and strict persistence writer

**Prospective agent:** AG-PP-201 (unique). **Size:** M. **Depends on:** PP-101, PP-102. **Cross-review:** P+S.

**Design and implementation scope:** Define Pi extension-owned grant-v1/revoke-v1 custom entries; no credentials or entire tool arguments; validate identifiers, exact key sets, sessionId, stable server fingerprint and revision. Write only through appendEntry and verify durability before using in-memory grant. Separate from adapter's mcp-approval-v1 state.

**Acceptance / Definition of Done:** Unknown or malformed records ignored for allow; appended success yields durable grant; an uncertain append re-reads session or fails closed.

**Required tests and failure cases:** Malformed records, disk failure before/after append, stale grant serialization roundtrip.

**Source targets / report:** Pi extension new storage module; Pi session-manager API. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-202 — Restore grants from active tree and revokes globally

**Prospective agent:** AG-PP-202 (unique). **Size:** L. **Depends on:** PP-201. **Cross-review:** P+S+T.

**Design and implementation scope:** Fold grants only from getBranch() current parent lineage; scan getEntries() across entire Pi session for monotonic revoke tombstones, including those written on sibling branches. Bind entries to Pi session ID, no grant inheritance across a fork/new session. Recompute when session_start, session_tree, session switch and resume occurs.

**Acceptance / Definition of Done:** Sibling switches do not resurrect revoked grants; ancestor grants survive on descendants; new session/fork begins without inherited permission; invalid entries cannot grant.

**Required tests and failure cases:** Multi-branch fixture, revoke sibling transition, fork/new/resume and tampering tests.

**Source targets / report:** Pi extension state projector; Pi getBranch/getEntries. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-203 — Implement scope lattice and exact semantic matcher

**Prospective agent:** AG-PP-203 (unique). **Size:** L. **Depends on:** PP-101, PP-102, PP-103, PP-201. **Cross-review:** P+G+S.

**Design and implementation scope:** Two sticky grants: tool_session matching original tool + exact semantic key; resource_session matching vetted equivalent tools on exact resource. No wildcard across GitLab host, actor, project or operation. Whole-branch grant explicitly all files on that Git branch; optional path-scoped branch choice only when complete effects and path checking are proven.

**Acceptance / Definition of Done:** Matching is monotonic least-privilege: same branch different operation/actor/project denied; broad but not omnipotent resource scope; opaque mutations never auto-reuse.

**Required tests and failure cases:** Table and property-based tests, operation lattice crossing, all-file warnings, negative equivalence.

**Source targets / report:** Pi extension matcher; classification fixtures. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-204 — Persist only after linked tool success (two-phase grant)

**Prospective agent:** AG-PP-204 (unique). **Size:** L. **Depends on:** PP-201, PP-203, PP-302, PP-303. **Cross-review:** P+A+S.

**Design and implementation scope:** On user sticky selection create pending proposal bound to local actual invocation, nested nonce, adapter connection epoch and Pi session generation. Reply one-shot accept to server; only after final non-error, noncancelled known result commit record. Never grant from elicitation accept alone; idempotent commit and fail-closed persistence.

**Acceptance / Definition of Done:** Failed, partially successful, cancelled, timeout and unknown outcomes leave no reusable grant. Concurrent results cannot commit grant for another call.

**Required tests and failure cases:** Controlled failpoint between prompt, dispatch, result and append; replay and out-of-order outcomes.

**Source targets / report:** Pi extension pending grants; adapter outcome callback. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-205 — Session lifecycle, generation invalidation and races

**Prospective agent:** AG-PP-205 (unique). **Size:** L. **Depends on:** PP-202, PP-204. **Cross-review:** P+A+T.

**Design and implementation scope:** Increment generation on tree/session switch, shutdown, revoke and config changes; close/cancel pending forms, inspect active epoch before positive replies and before persistence. Differentiate Pi session tree branch vs Git branch. Handle adapter reconnect and multi-inflight; cache only validated projection.

**Acceptance / Definition of Done:** No stale approval after navigation/revoke/disconnect; reconnect with same trusted identity permits reuse of prior grant, not pending answers.

**Required tests and failure cases:** Abort during dialog, call dispatch, reconnect, tree switch, 2+ parallel calls.

**Source targets / report:** Pi lifecycle handlers; Pi session events; adapter connection lifecycle. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-206 — Human approval UI and inspect/revoke commands

**Prospective agent:** AG-PP-206 (unique). **Size:** M. **Depends on:** PP-203, PP-205. **Cross-review:** P+S+D.

**Design and implementation scope:** Design minimal clear TUI: server/host/account/project/target/operation/dangerous flags; Deny, Allow once, Allow matching operation for this tool/session, Allow matching operation on resource/session. Highlight whole-branch risk including CI files; separate non-authz forms. Implement /permissions list, show, revoke <id>, clear (human commands only).

**Acceptance / Definition of Done:** No accidental approve on Enter; no secret content; every grant visible and irrevocably revocable across Pi tree; headless never prompts to auto-create grant.

**Required tests and failure cases:** UI snapshots, keyboard shortcuts, no-UI mode, redaction, broad branch copy, global revoke.

**Source targets / report:** Pi extension TUI and slash-command handlers. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.


### E3 — pi-mcp-adapter interoperability

Public nested elicitation interception, trusted correlation, outcomes, fallback.

#### PP-301 — Expose narrow adapter nested authorization event hook

**Prospective agent:** AG-PP-301 (unique). **Size:** L. **Depends on:** PP-001, PP-002, PP-101. **Cross-review:** A+P+S.

**Design and implementation scope:** Before adapter's regular elicitation UI, emit a documented versioned claimable event from trusted extension context, restricted to form authorization requests. Preserve normal form/URL behavior, timeout pause, abort, single-winner arbitration and validation. If no claim, pass through to standard UI. Prefer upstream change over private fork.

**Acceptance / Definition of Done:** External Pi permission extension can claim recognized authorization form; unclaimed arbitrary elicitation unchanged; no hook callable from model tools; clear public API docs.

**Required tests and failure cases:** Adapter conformance suite for claim arbitration, error, decline, cancel, unrelated forms and plugin ordering.

**Source targets / report:** pi-mcp-adapter/elicitation-handler.ts; index.ts; public exports/docs. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-302 — Correlate actual in-flight MCP call, origin and server identity

**Prospective agent:** AG-PP-302 (unique). **Size:** L. **Depends on:** PP-001, PP-301. **Cross-review:** A+S+T.

**Design and implementation scope:** Add trusted adapter per-call registry (toolCallId, orig tool, exact args/digest, connection epoch, configured endpoint/fingerprint, Pi session generation) so nested elicitation cannot take client-supplied or server-supplied arbitrary identity as proof. Support direct, proxy, codemode/mcpScript, runtime calls and UI iframe; reject ambiguous associations.

**Acceptance / Definition of Done:** Every eligible nested form binds to exactly one live originating call; if zero/multiple candidates, no silent approval; cross-origin and parallel call isolation.

**Required tests and failure cases:** Concurrent, reordered nested elicitations, reused server name, nested requests, malformed correlation.

**Source targets / report:** pi-mcp-adapter server-manager.ts; protocol transport; direct-tools; mcp-code. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-303 — Publish reliable tool completion, abort and uncertainty hook

**Prospective agent:** AG-PP-303 (unique). **Size:** L. **Depends on:** PP-302. **Cross-review:** A+P+T.

**Design and implementation scope:** Expose final outcome of original MCP invocation to Pi owner with true MCP isError, cancellation, response stream status and connection epoch. Cover ordinary call, proxy and mcpScript nested calls. Do not infer success from UI accept, Pi wrapper text or transport ack.

**Acceptance / Definition of Done:** Only a known successful tool result can commit a pending sticky grant; late/duplicate outcome ignored; partial GitLab error and network drop recognized unknown.

**Required tests and failure cases:** Failure injection at result parsing, adapter timeout/disconnect, parallel calls and shutdown.

**Source targets / report:** pi-mcp-adapter tool execution wrappers; abort.ts; result handling. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-304 — Preserve generic MCP approval and full capability compatibility

**Prospective agent:** AG-PP-304 (unique). **Size:** M. **Depends on:** PP-301, PP-302, PP-303. **Cross-review:** A+P+D.

**Design and implementation scope:** Integrate Pi-specific event with existing adapter tool-approval broker without suppressing server elicitation or granting unrelated tools; ensure capabilities and UI advertised only when available, and headless/human fallback. Explicitly test both forms and URL elicitation.

**Acceptance / Definition of Done:** No accidental double prompt for recognized flow, no silent generic approval, standard non-Pi one-shot works, read mode unchanged; no duplicate MCP manager.

**Required tests and failure cases:** Proxy/direct/mcpScript/iframe/runtime, no adapter, headless, unknown metadata/version.

**Source targets / report:** pi-mcp-adapter docs; broker; elicitation handler. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-305 — Assess eventual Pi built-in MCP support (post-MVP)

**Prospective agent:** AG-PP-305 (unique). **Size:** S. **Depends on:** PP-001, PP-002. **Cross-review:** A+P.

**Design and implementation scope:** Document upstream gap for Pi built-in elicitation and whether public extensibility exists. Propose upstream issue/PR interfaces for future support, explicitly not a dependency on changing Pi core for adapter-based MVP.

**Acceptance / Definition of Done:** Clear compatibility ADR and recommendation; no invented built-in API; automatic reuse disabled on unsupported Pi mode.

**Required tests and failure cases:** Smoke test against pinned Pi built-in implementation.

**Source targets / report:** Pi packages/coding-agent/src/extensions/mcp. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.


### E4 — GitLab MCP stateless consent and mutation guards

Make server per-call enforcement authoritative; remove server-side sticky state.

#### PP-401 — Migrate stacked GitLab MCP PRs to Pi-owned grants

**Prospective agent:** AG-PP-401 (unique). **Size:** L. **Depends on:** PP-002, PP-101, PP-103. **Cross-review:** G+P.

**Design and implementation scope:** Keep PR #1 ask mode foundation and reusable PR #2 classifier/tests; remove ApprovalManager's in-process sticky map and connection lifetime semantics. Replace scope selection in server with standard one-shot form; server asks on EVERY mutation including later Pi reuse. Update PR stack to avoid merging a temporary server-owned grant model into final architecture.

**Acceptance / Definition of Done:** No persistent or connection-wide grants in MCP; protocol works with ordinary form client; no regression in read/ask/full/modify policy modes.

**Required tests and failure cases:** PR1/PR2 current test suite plus new stateless repeated-call tests; no hidden cache.

**Source targets / report:** src/lib/elicitation.ts; src/tools/gitlab.ts; PR #1/#2. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-402 — Emit authoritative, bounded, versioned authorization intents

**Prospective agent:** AG-PP-402 (unique). **Size:** L. **Depends on:** PP-101, PP-102, PP-103, PP-401. **Cross-review:** G+A+S.

**Design and implementation scope:** Attach standardized v1 private metadata to each recognized server-side form with canonical authenticated GitLab identity and complete effect flags/paths. Keep standard flat form and redacted readable summary for ordinary clients. Generate unique nonce and bind request to originating tool invocation. Validate accepted content and abort state before dispatch.

**Acceptance / Definition of Done:** Pi sees exact scoped operation; no secrets; metadata and standard form accepted by validated SDK; unsupported client can still manually consent once.

**Required tests and failure cases:** Integration protocol fixture, oversize/redaction, nonce binding and malformed content.

**Source targets / report:** src/lib/elicitation.ts; src/tools/gitlab.ts; auth-context.ts. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-403 — Propagate cancellation through GitLab request dispatch

**Prospective agent:** AG-PP-403 (unique). **Size:** L. **Depends on:** PP-401, PP-402. **Cross-review:** G+S+T.

**Design and implementation scope:** Map MCP tool call AbortSignal and cancelled nested form to GitLab client request, before-dispatch gate and no further retries after abort. Audit every handler especially multi-request batches and GraphQL. Distinguish abort-before-dispatch from response-unknown-after-dispatch and avoid false rollback claims.

**Acceptance / Definition of Done:** Zero write dispatched if cancellation occurred before dispatch. If server started API call, outcome reported unknown when needed; Pi never caches a grant.

**Required tests and failure cases:** Delayed GitLab HTTP stub, pre/post dispatch abort, retries and partial batch failures.

**Source targets / report:** src/lib/gitlab-client.ts; src/tools/gitlab.ts; request-runtime.ts. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-404 — Close mutation-classifier bypasses in GitLab server

**Prospective agent:** AG-PP-404 (unique). **Size:** L. **Depends on:** PP-003, PP-104, PP-401. **Cross-review:** G+S+T.

**Design and implementation scope:** Check all GraphQL query/mutation operations incl aliases/multiple operations; fast paths such as update note with slash command, filemode, force, rename/move and retarget. Reconcile generic tool capability with runtime arguments. Tighten limits and require per-call approval for every effect.

**Acceptance / Definition of Done:** Audit inventory has no unidentified writable path; negative cases do not touch GitLab without direct human one-shot or are hard denied.

**Required tests and failure cases:** GraphQL parse fixtures, tool registry diff guard, fuzz quick actions and filemode false.

**Source targets / report:** src/tools/gitlab.ts; GraphQL guard; tests/graphql-guard.test.ts. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-405 — Secure stdio/HTTP session and multi-tenant identity behavior

**Prospective agent:** AG-PP-405 (unique). **Size:** M. **Depends on:** PP-102, PP-401, PP-402. **Cross-review:** G+A+S.

**Design and implementation scope:** Verify nested elicitation on local stdio and sessionful Streamable HTTP; check per-request remote auth context and actor identity, server session lifecycle and isolation. Stateless/JSON HTTP without reverse requests must deny writes under ask. Detect endpoint/account changes on reconnect.

**Acceptance / Definition of Done:** No cross-user or cross-transport sticky reuse; unsupported HTTP returns explicit deny; no PAT forwarded into model sandbox.

**Required tests and failure cases:** HTTP parallel clients, token rotation, distinct identity same project, disconnections.

**Source targets / report:** src/http-app.ts; src/lib/auth-context.ts; MCP transport config. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.


### E5 — Security hardening and operational isolation

Protect credentials and state, classify uncertainty, fuzz grant widening.

#### PP-501 — Ship reproducible Pi host + MCP credential isolation profile

**Prospective agent:** AG-PP-501 (unique). **Size:** L. **Depends on:** PP-004, PP-405. **Cross-review:** S+P+D.

**Design and implementation scope:** Document/run Pi host, privileged MCP process and untrusted agent tools in distinct security domains. Prevent agent shell/codemode reaching PAT/session JSONL/privileged MCP socket. Restrict GitLab project and token scope, protected main branch and project config trust; include verified setup for Mac local workflows.

**Acceptance / Definition of Done:** Actual automated adversarial sandbox test passes and deployment docs describe trust boundaries; otherwise explicit 'not secure' warning and no silent consent.

**Required tests and failure cases:** Credential exfil and writable API bypass attempts in restricted environment.

**Source targets / report:** deployment documentation; sandbox scripts. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-502 — Handle write outcome unknown, partial success and idempotency

**Prospective agent:** AG-PP-502 (unique). **Size:** M. **Depends on:** PP-303, PP-403. **Cross-review:** S+G+T.

**Design and implementation scope:** Define failure response taxonomy (denied, cancelled before dispatch, aborted after dispatch, timeout unknown, partial batch, success) propagated to Pi. Avoid retrying non-idempotent GitLab writes blindly; do not grant after partial or unknown results.

**Acceptance / Definition of Done:** End-user sees accurate status, no false claims of rollback, no granted sticky after ambiguous write.

**Required tests and failure cases:** Network drops at every API stage and partial multi-file operation.

**Source targets / report:** GitLab request runtime; adapter outcome model. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-503 — Adversarial fuzz and authorization widening review

**Prospective agent:** AG-PP-503 (unique). **Size:** L. **Depends on:** PP-104, PP-203, PP-302, PP-404. **Cross-review:** S+G+P+T.

**Design and implementation scope:** Cross-check effect classifier vs client matcher for differences in normalization and scope; fuzz malformed metadata, duplicate fields, UTF-8/encoded paths, GraphQL aliases, tool names, host/principal switches and session-tree revoke resurrection. Audit model tool access to event broker.

**Acceptance / Definition of Done:** No case lets a grant authorize a strictly larger semantic effect or different principal/resource; publish security assessment and unresolved limitations.

**Required tests and failure cases:** Property-based matcher invariants plus E2E negative matrix and manual audit.

**Source targets / report:** SECURITY.md; classifier/matcher tests; protocol fixtures. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.


### E6 — Integration, CI, docs and release

Prove full end-to-end behavior, migrate existing PR stack, document all limits.

#### PP-601 — Build reproducible Pi–adapter–GitLab MCP integration harness

**Prospective agent:** AG-PP-601 (unique). **Size:** L. **Depends on:** PP-001, PP-301, PP-401. **Cross-review:** T+A+G.

**Design and implementation scope:** Wire actual Pi runtime + adapter + GitLab MCP ask mode against fake GitLab HTTP API and fake human Pi UI for local/CI tests; emulate Pi session tree, abort, reconnection and HTTP failures without live credentials.

**Acceptance / Definition of Done:** One command runs E2E on pinned versions in CI; fixtures share same intent schema as production; record tool origins and requests safely.

**Required tests and failure cases:** Stdio success/error paths, simultaneous calls, session restore and mock GitLab request traces.

**Source targets / report:** tests/integration/; fake GitLab transport; CI. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-602 — Implement full authorization acceptance matrix

**Prospective agent:** AG-PP-602 (unique). **Size:** L. **Depends on:** PP-202, PP-204, PP-206, PP-304, PP-405, PP-601. **Cross-review:** T+S.

**Design and implementation scope:** Translate TEST-PLAN.md T01–T40 into automated tests incl cross-instance, special flags, no-UI, unknown version, all tool call origins, resume, fork, revoke on sibling tree, cancelled mutation and persistence faults.

**Acceptance / Definition of Done:** All mandatory cases pass with traceable fixture; explicitly list cases blocked by upstream limitations instead of silent skips.

**Required tests and failure cases:** At least one negative security assertion for each permitted sticky operation; nightly dependency-compatibility matrix.

**Source targets / report:** TEST-PLAN.md; integration and property tests. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-603 — Pin versions, CI workflow and documentation consistency checks

**Prospective agent:** AG-PP-603 (unique). **Size:** M. **Depends on:** PP-601. **Cross-review:** T+D.

**Design and implementation scope:** Add supported Pi/adapter/MCP SDK matrix, contract fixture validation, GitLab tests, CI typecheck/lint and dependency vulnerability scanning; ensure docs and schema stay synced. Keep branch planning separate from implementation CI and do not silently update production deps.

**Acceptance / Definition of Done:** Pull requests cannot merge with failing negative tests or unreviewed capability map; versions and matrix visibly reported.

**Required tests and failure cases:** CI test proving unclassified new mutation tool breaks coverage; test on Node 24/Linux and Mac where available.

**Source targets / report:** GitHub Actions workflows; lockfiles; docs checker. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-604 — Migration, configuration and user workflows

**Prospective agent:** AG-PP-604 (unique). **Size:** M. **Depends on:** PP-401, PP-206, PP-304, PP-501. **Cross-review:** D+P+G.

**Design and implementation scope:** Document plugin installation, ask mode, adapter requirement vs built-in Pi, safe fallback, trust server allowlist, per-call and sticky scope semantics, session resume/reconnect, list/revoke, HTTP limitations and deployment credentials. Plan PR #2 reconciliation and how to handle preexisting server-owned temporary approvals.

**Acceptance / Definition of Done:** User can install and understand scope, revoke and failures; docs never claim real sandbox isolation without validated profile.

**Required tests and failure cases:** Docs smoke test with fresh Pi config, unsupported client and simple scenario.

**Source targets / report:** README; docs/configuration.md; migration notes. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

#### PP-605 — Integrate, security-signoff and release-gate review

**Prospective agent:** AG-PP-605 (unique). **Size:** L. **Depends on:** PP-502, PP-503, PP-602, PP-603, PP-604. **Cross-review:** S+P+A+G+T+D.

**Design and implementation scope:** Coordinator reconciles contracts and stacked PR migrations across repositories; require independent security reviewer and T lead to sign off G0–G4/S1–S7. Verify all docs and research sources pinned; avoid merge of partial permission escalation.

**Acceptance / Definition of Done:** Accepted release checklist or explicit no-go with human-only ask fallback. Final report links every ticket, test and source decision; no undocumented security exception.

**Required tests and failure cases:** Final adversarial replay, integration demonstration, clean install and regression across origins.

**Source targets / report:** ADR bundle; release checklist; CI artifacts. Agent must share new facts in the relevant research/ Markdown file and update any impacted ADR/contract; coordinate API changes with its dependencies.

## Critical-path and project-wide acceptance

1. G0 proves nested metadata and trustworthy adapter-to-tool correlation (PP-001). If not, no auto-reuse.
2. G1 confirms public adapter hook, full origins, post-result feedback (PP-301–304).
3. G2 documents and tests cancellation and unknown outcomes (PP-303, PP-403, PP-502).
4. G3 closes unexpected GitLab mutations (PP-003, PP-104, PP-404).
5. G4 confirms Pi state/PAT/transport isolation from the agent sandbox (PP-004, PP-501).
6. Test acceptance T01–T40 passes; full release needs signoff PP-605.

## Explicit exclusions from MVP

No permanent 'allow forever', wildcard cross-project/all-GitLab grants, default timeout of 30 minutes, server-owned sticky approval cache, silent approval of arbitrary MCP forms, credential exposure to agent tool sandbox, unbounded path wildcards, or optimistic grants after failed/uncertain tool results.

## Agent expansion protocol

Any agent may propose a new implementation ticket or split its own only after a written scope-gap RFC and consultation with relevant neighboring owner(s). Coordinator assigns a new unique ID and AG owner and revises dependency graph. Security-critical negative tests may create tickets as blockers immediately, but cannot be waived by the implementation owner.

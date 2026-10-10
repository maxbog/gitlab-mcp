# Security — Pi Permissions

Date: 2026-10-10. Planning, not a completed security audit.

## Threat model

Trusted: human Pi TUI action, protected Pi extension runtime, audited MCP adapter transport, privileged GitLab MCP server, GitLab access controls. Untrusted: model instructions, retrieved issues/code, model-driven shell/codemode, arbitrary MCP servers and project-supplied config. Pi session logs and write PAT are **not** safely isolated when agent shell has the same unrestricted filesystem and process access as the host.

## Non-negotiable invariants

- S-01: The model cannot forge a permission by writing Pi session history, triggering extension events or directly connecting to privileged MCP or GitLab APIs.
- S-02: GitLab server policy runs before an approval and checks the actual target of **every** mutation.
- S-03: Only allowlisted GitLab MCP connections with a verified source and matching in-flight call may reuse consent.
- S-04: Changing server config, host, GitLab authenticated principal, numeric project ID, target resource, operation classifier revision or tool scope invalidates reuse.
- S-05: Grant committed only after verified success and durable session append; errors, unknown status, cancellation and timeout cannot create grants.
- S-06: No stale prompt from a previous Pi session generation or server connection may yield acceptance.
- S-07: Metadata and free-text tool output are never inherently trusted, and arbitrary elicitation is never auto-approved.
- S-08: A revoked grant stays revoked across all Pi conversation-tree branches and resumed sessions. Global revocation tombstones are scanned from all session entries; grants only from active lineage.
- S-09: No sticky grant for admin, delete, GraphQL, force, rename, mode changes, quick-action side effects, ambiguous/mixed batch effects.
- S-10: Unrecognized or incomplete information always means deny or fresh human one-shot approval.

## Attack/test pairs

| Scenario | Risk | Required defense |
|---|---|---|
| Agent edits JSONL | Forge approval | Agent sandbox cannot access Pi state; strict shape checks |
| Agent reads PAT or MCP socket | Bypass Pi | Credential and transport isolation; least-privilege PAT |
| Rogue MCP forges metadata | Confused deputy | Transport-level identity + allowlist + exact correlation |
| Same project path on two hosts | Cross-instance consent | Host+actor+numeric project canonical identity |
| Credential rotation or account change | Wrong principal | Verify authenticated principal per operation |
| GraphQL aliases/batch mutations | Hidden write | Conservative parser or once-only approval |
| Comment containing /close, /merge | Unexpected state change | Detect quick actions; disallow sticky |
| File mode flag false / force / move | Wrong risk category | Normalize complete effects, forbid sticky |
| Tool result arrives after revoke/switch | Stale authorization | Generation/epoch check and pending invalidation |
| Cancelled tool still writes | Post-cancel mutation | Abort-aware API, guard before dispatch, unknown-outcome reporting |
| Server replacement same name | Identity spoof | Hash effective config, bind endpoint and transport |
| Switch to tree sibling after revoke | Grant resurrected | Global tombstones from session getEntries |
| Codemode, iframe, runtime calls | Authorization bypass | Intercept nested elicitation at adapter layer |
| Branch grant includes CI scripts | Supply-chain risk | Explicit full-branch warning, GitLab protections, path constraint option |
| Noninteractive execution | Silent unsafe allow | Fail closed, allow reads only |

## Policy

Keep readonly free under configured GitLab rules. Fresh human one-shot approvals work for known mutations. Offer sticky only for well-classified low-risk effects on exact resources and actor/project identity. An all-files-on-branch grant is explicit and risky: it includes CI and configuration files. Do not introduce arbitrary safePath filename exceptions as a security guarantee.

## Release gates

1. Contract and negative mutation tests (GraphQL aliases, quick actions, chmod, batch, host/account confusion).
2. Server cancellation and delayed GitLab HTTP tests.
3. Real sandbox test proving PAT/session/socket isolation.
4. Revoke across session-tree branches and late prompts.
5. Ordinary forms and URL elicitation never auto-approved.
6. Origin coverage: direct, proxy, mcpScript, UI, runtime.
7. Pinned Pi/adapter/GitLab integration CI and independent security review.

If a gate fails, the safe delivery is manual per-call ask mode, not silent grant reuse.

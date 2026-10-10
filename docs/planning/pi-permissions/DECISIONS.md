# Decision and handoff log — Pi Permissions

This is the coordinator's planning log as of 2026-10-10. Research entries are from direct source review. No separate agents were launched.

## Accepted design decisions

| ADR | Decision | Why | Depends on |
|---|---|---|---|
| ADR-01 | Pi owns sticky session grants, GitLab MCP owns per-call execution safety | Sessions, tree, revocation and UX belong to client; server cannot safely own multi-Pi-session consent | PP-201, PP-401 |
| ADR-02 | Standard MCP one-shot form elicitation remains on every mutation | Works for non-Pi clients, and prevents grant storage in server | PP-301, PP-402 |
| ADR-03 | Prefer narrow public hook to pi-mcp-adapter rather than fork all of Pi | Adapter has elicitation, cancellation/timeouts and session approval infrastructure | PP-001 G0, PP-301 |
| ADR-04 | Grant persistence only after successful linked tool result | UI acceptance alone is not successful mutation | PP-204, PP-303 |
| ADR-05 | Grants use Pi session lifetime, not MCP connection or 30-minute TTL | Session is user's explicit semantic boundary | PP-202 |
| ADR-06 | Global revocation tombstones from getEntries; grants from getBranch | Revoke on sibling Pi tree branch must not resurrect old grant | PP-202 |
| ADR-07 | No arbitrary safePath denylist | Cannot soundly mark mutable repository contents safe by filename; use explicit scope + GitLab ACL | PP-203 |
| ADR-08 | Opaque/GraphQL/delete/admin/quick-action/mode/force/move once-only | Prevent implicit privilege expansion | PP-104, PP-404 |
| ADR-09 | Credential isolation is independent mandatory gate | Approval API alone does not stop model curl when PAT or privileged transport available | PP-004, PP-501 |

## Unverified implementation assumptions (must be researched)

- U-01: Current MCP SDK preserves request _meta for server-to-client nested elicitation and exposes robust originating request association. G0 blocking; owner AG-PP-001.
- U-02: A public adapter hook can be added without jeopardizing ordinary form/URL prompts, timeout pausing or call origin. Owner AG-PP-301.
- U-03: All successful/failed tool outcomes can be captured for proxy, direct, codemode/mcpScript, runtime and UI iframe. Owner AG-PP-303.
- U-04: GitLab client dispatch cancellation can prevent post-cancel writes at least before API request start. Owner AG-PP-403.
- U-05: Installed Pi getEntries contains all session tree events regardless of selected leaf, permitting global tombstones. Source API suggests yes; executable regression required. Owner AG-PP-202.
- U-06: Same-session forks and resumed sessions expose stable identity semantics per the chosen Pi version. Owner AG-PP-205.
- U-07: Pi host sandbox is actually isolated from agent-supplied code and GitLab PAT custody. Owner AG-PP-004.

## Report index

- research/pi.md — session API and built-in MCP.
- research/adapter.md — external adapter hooks and built-in approval cache.
- research/gitlab.md — PR #1/#2, mutation inventory entrypoints and vulnerabilities.
- research/mcp.md — protocol constraints and metadata experimental seam.
- CONTRACT.md, STORAGE.md, SECURITY.md — agreed proposed models with G0-dependent portions.
- BACKLOG.md — 33 uniquely assigned prospective agent briefs.

## Change-control template for later agent messages

Decision ID / ticket / proposer / reviewers consulted / source paths and exact revision / observed behavior / alternatives / chosen design / rejected options / API or test changes / coordinator outcome / follow-up owner. If a new issue is needed, its proposer consults adjacent owners and submits a ticket RFC; the coordinator adds it to BACKLOG.md with a new unique agent ID.

## Current blocker summary

Automatic reuse is **not** safe to implement before G0, G1 and G4. A viable fail-closed interim result is GitLab MCP ask mode with ordinary per-call human confirmation.

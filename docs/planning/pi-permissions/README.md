# Pi Permissions — design workspace (2026-10-10)

**Status:** planning only. This branch deliberately changes documentation, not executable code. Source implementation being reviewed is the stacked GitLab MCP PRs [#1](https://github.com/maxbog/gitlab-mcp/pull/1) and [#2](https://github.com/maxbog/gitlab-mcp/pull/2); neither is assumed merged.

## Decision

Pi owns user grants and their lifecycle; MCP servers own and enforce the semantics of their mutations. GitLab MCP re-evaluates the exact request each time and uses MCP form elicitation; a trusted Pi extension may respond on behalf of a previously approved, matching grant. MCP does **not** own any sticky-grant database. This is NOT credential isolation; Pi and its terminal tools must be separated from server credentials.

## Documents

- [ARCHITECTURE.md](ARCHITECTURE.md): trust model, components, end-to-end flows, choices.
- [CONTRACT.md](CONTRACT.md): versioned authorization intent and normalization.
- [STORAGE.md](STORAGE.md): Pi session-tree grants, revocation, invariants.
- [SECURITY.md](SECURITY.md): security model and adversarial cases.
- [BACKLOG.md](BACKLOG.md): implementation epics and individually testable tickets.
- [AGENT-COORDINATION.md](AGENT-COORDINATION.md): agent briefs, collaboration, conflict arbitration, completion checks.
- [TEST-PLAN.md](TEST-PLAN.md): contract, behavioral, and integration test scenarios.
- [research/pi.md](research/pi.md), [research/adapter.md](research/adapter.md), [research/gitlab.md](research/gitlab.md), [research/mcp.md](research/mcp.md): source-based findings and uncertainties.

## Scope & principles

In scope: GitLab mutation classification; stdio MCP elicitation and supported sessionful HTTP; Pi approval extension; branch-scoped/operation-scoped/user-revocable session grants; safe defaults; tests, migration, docs. Out of scope for MVP: changes to cloud IAM, credential forwarding into an agent sandbox, permanent cross-session grants, generic automatic approval of arbitrary elicitation, and implementing any of the listed tickets on this planning branch.

### Important implementation gates

G0 — establish how Pi receives and correlates nested elicitation with originating tool calls.
G1 — expose a **public** adapter elicitation authorization hook without bypassing its normal UI for other elicitation.
G2 — prove fail-closed behavior under cancellation and disconnection, including no write after cancel.
G3 — ensure no GitLab mutation path, GraphQL alias or quick action silently bypasses authorization.
G4 — prove the MCP connection cannot be commandeered from the untrusted agent's shell, and no writable GitLab credential is accessible there.

### Research provenance

References point to current upstream default branches viewed on 2026-10-10, and the GitLab MCP feature branch from PR #2. Pin concrete SHA/version before implementation; do not treat current main as immutable.

### Agent execution status

The current ChatGPT tool environment did not expose a subagent-spawning runtime. **No independent agents were actually launched.** Each ticket has a distinct prospective agent brief and a communication handoff, but assignment is a plan, not proof of execution. All source research in this packet was performed directly by the coordinator. Do not mark future agents as started without an actual execution receipt.

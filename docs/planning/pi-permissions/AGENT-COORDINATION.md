# Multi-agent coordination protocol

Date: 2026-10-10. Planning phase. **No separate subagents have been launched from this session:** the available tools do not expose an agent runner. This file defines how distinct agents can execute the backlog and cooperate when an executor is available. It is not an activity report for fictitious agents.

## Roles and responsibilities

Coordinator (integration owner): maintains architecture, ADR, contract versions, dependency graph, source research index and final release decisions. No agent may unilaterally expand a grant's authority.

Specialist leads:
- P / Pi lead: Pi extension lifecycle, session JSONL, branching, revocation, UI.
- A / Adapter lead: MCP nested elicitation, transport identity, tool outcome, abort/deadline, public extension API.
- G / GitLab lead: concrete tool effects, identity, policy, operation classifier, HTTP dispatch.
- S / Security lead: threat model, sandbox validation, negative tests, danger classification and veto.
- T / Testing lead: protocol harness, property/E2E cases, CI and compatibility.
- D / Documentation lead: user-facing installation, migrations, diagnostics and changelog.

Every ticket in BACKLOG.md has a **unique prospective AG-<ticket-id> owner**. One named research domain must review a neighbor's deliverable. These are assignment templates, not claims of instantiated workers.

## Agent handshake rules

1. Each owner reads README.md, ARCHITECTURE.md, CONTRACT.md, STORAGE.md, SECURITY.md and relevant research/ report before acting.
2. An agent researches source and docs before designing behavior. Record source URL, repo path, exact SHA/tag (once pinned), observed code semantics and date in a Markdown report.
3. Distinguish VERIFIED (source/read test), HYPOTHESIS (requires experiment), DECISION (coordination agreement), BLOCKER (cannot implement safely) and PROPOSAL (not accepted).
4. Share evidence through durable Markdown records or issue comments, never assumed private background conversation.
5. A ticket owner proposing a new ticket must first contact the lead of the affected subsystem and one adjacent owner, add a short RFC with motivation, dependency, acceptance criteria, and indicate why an existing ticket is insufficient. Coordinator decides whether to add, merge or reject. New tickets have new unique AG owners.
6. Any change to authorization payload, grant match semantics, response/cancel behavior needs approval from P + A + G leads and S security lead before adoption.
7. Risk widening (for example broad path patterns or silent approval of admin operations) is blocked until S lead reviews and T lead adds negative tests.
8. When agents disagree, coordinator resolves via source evidence and experiments, documents alternatives and decision; never resolves by silently picking the easier implementation.
9. Any obsolete report is marked superseded, not silently overwritten; other agents can still review provenance.
10. Agents should challenge each other for missed origins: Pi tool events vs mcpScript, iframe, direct MCP client, session switch, retries and partial failures.

## Communication surfaces

- Shared documents in docs/planning/pi-permissions/.
- Before implementation, use a decision log file (DECISIONS.md) with entry ID, proposal, supporting evidence, reviewers and outcome.
- During later implementation, GitHub issue references and draft PRs become exchange locations. Give every agent a branch/PR tied to its ticket.
- A GitHub Issue is not itself an agent executor. Capture a real agent launch identifier, tool, session and output before claiming execution.

## Expected research deliverables for every ticket

- Source code and documentation locations, pinned revision.
- Exact public API or algorithm proposal, alternatives considered, failure cases and operational model.
- Acceptance criteria with reproducible tests.
- A report in Markdown or explicit link to updated research/ doc.
- Two neighbor handoffs: incoming contract assumptions and outgoing test/contract fixtures.
- Recommendation whether ticket is ready, blocked by gate, or should be split.

## Dependency coordination

G lead publishes canonical GitLab operation fixtures to A/P/S/T.
A lead publishes nested call correlation and outcome fixtures to P/G/T.
P lead publishes grant schema and tree-replay fixtures to A/S/T.
S lead publishes adversarial cases and sandbox findings to all.
T lead verifies no tool origin or operation is missing; uncovered cases become proposed new tickets.

## Planning and merge sequence

Stage 0: Prove G0 compatibility. Finish threat model and operation inventory in parallel.
Stage 1: Ratify versioned contract / session store / adapter public hook with all leads.
Stage 2: Implement independently testable pure grant matching and GitLab effect semantics.
Stage 3: Wire adapter interception and server form approval; add end-to-end harness.
Stage 4: Integrate Pi user workflow and session persistence; run adversarial negative suites.
Stage 5: Produce migration plan and documentation, run release gates, review and merge small PRs.

## Coordinator acceptance checklist

One owner per ticket, no dangling dependencies, no unresolved high-severity conflict, every verified statement linked to source/test, every grant widening covered by matching negative tests, no direct credential use in model sandbox, explicit fail-closed downgrade path and durable report index.

## Status from this planning pass

Coordinator independently reviewed source for Pi built-in MCP, Pi session/extension APIs, pi-mcp-adapter handler and session approvals, GitLab MCP PR #1/#2 and MCP elicitation specification. Real agent launches and cross-agent peer reviews require a separate supported executor; do not mark them complete based on this document.

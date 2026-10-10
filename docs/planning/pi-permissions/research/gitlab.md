# Source review: maxbog/gitlab-mcp PR #1 and PR #2

Reviewed 2026-10-10:
- [PR #1: elicitation approval](https://github.com/maxbog/gitlab-mcp/pull/1)
- [PR #2: session-scoped sticky approvals](https://github.com/maxbog/gitlab-mcp/pull/2), based on PR #1
- [GitLab tool registry](https://github.com/maxbog/gitlab-mcp/blob/feature/scoped-sticky-approvals/src/tools/gitlab.ts)
- [Approval manager and classifier](https://github.com/maxbog/gitlab-mcp/blob/feature/scoped-sticky-approvals/src/lib/elicitation.ts)
- [Policy engine](https://github.com/maxbog/gitlab-mcp/blob/feature/scoped-sticky-approvals/src/lib/policy.ts)
- [Sticky integration tests](https://github.com/maxbog/gitlab-mcp/blob/feature/scoped-sticky-approvals/tests/integration/sticky-approvals.integration.test.ts)

## Current PR behavior

PR #1 adds `GITLAB_PERMISSION_MODE=ask`: read operations pass; write/delete/admin require MCP form elicitation; missing capability and decline fail closed. PR #2 adds `ApprovalManager` per MCP server instance, storing in-memory grants for `tool_session` and `resource_session` until connection close, without TTL. The registry in `src/tools/gitlab.ts` instantiates the manager, checks `context.policy.requiresApproval`, calls authorization with `relatedRequestId`, executes the GitLab handler and only then remembers a pending grant. Its classifier allows selected file create/update, MR comment/metadata, and issue create/comment/metadata operations. Delete/admin/GraphQL and certain compound effects remain one-shot.

## Why change

Server-side session storage is the wrong ownership boundary: a Pi session can span reconnections, a server cannot present one authoritative list/revoke interface for all MCP permissions, and grants should follow Pi's session-tree navigation, not a shared server process. New direction: the server **always** asks for authorization for each mutation, classifies and exposes an exact versioned operation footprint, validates the returned one-shot answer, and forgets it. Pi may supply that one-shot answer from a matching **Pi-owned** grant.

## High-risk security cases

- GraphQL mutation through aliases/batching/introspection patterns; never rely on tool name alone for mutation classification.
- GitLab note/MR/issue quick actions like `/close` or `/merge` can cause side effects beyond nominal comment permission.
- Arguments that change side effects: `execute_filemode: false` is still a permission change; `force`, `start_branch`, rename/move, delete and target branch changes should never be treated as routine create/update.
- Cancelled MCP tool calls may continue writing to GitLab if their abort does not reach the GitLab request.
- Project path aliases, URL hosts, mutable GitLab instance configuration, token identity and numeric project IDs must be part of canonical authorization identity. A grant for instance A cannot authorize instance B.
- `gitlab_push_files` can contain many actions with mixed privileges; one authorization must conservatively cover **all** effects and show a bounded readable preview without hiding security-relevant operations.
- A branch-wide grant covers every file on that Git branch, including `.gitlab-ci.yml`; there is no defensible arbitrary file-name `safePath` denylist. Prefer explicit resource/path-scope and warn when authorizing whole branch.

## Migration choice

Keep PR #1 as the base (with fixes as needed). **Do not merge PR #2 as the final ownership model unchanged.** Reuse its classification tests and schemas, refactor its `ApprovalManager` into a stateless elicitation presenter, move matching/session store into the Pi extension, and add negative tests before merge.

## Outstanding verification

Inspect handlers for GitLab API retry semantics, cancellation propagation, GraphQL parsing and tool-specific effects. Test all declared tools in the registry and document uncovered mutations with deny-by-default behavior. Do not assume partial PR implementation fixes every issue listed here.

**Verdict:** existing work supplies a strong starting point but requires architectural migration and security hardening.

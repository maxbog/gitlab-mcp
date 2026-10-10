# Autonomous GitLab agent — server-enforced security model

Date: 2026-10-10. Planning and threat-model conclusions, **not an implementation or successful penetration test**.

## Executive answer

**An agent need not ask a human for every push.** GitLab can enforce a read-only credential for fetch and a distinct write credential for feature-branch development while protecting default/release branches and merge approvals independently. The key distinction: **authorization to push repository objects is not pure 'file write'**; accepted commits, text directives, push options and CI jobs may create immediate or deferred side effects. For strict control use a credential-isolated trusted push broker, but for tolerable lower-risk autonomy a dedicated read-write deploy key + strong GitLab branch/CI settings can be sufficient with documented limitations.

## GitLab permission layers

1. **Credentials:** a project **read-only deploy key** is Git-over-SSH fetch only; a project **read-write deploy key** is Git-over-SSH fetch/push, not a blanket authenticated REST API. Access token `read_repository` is read-only Git-over-HTTP and repository files; `write_repository` permits Git-over-HTTP push but not general writable REST API. `api` can grant much broader API rights **subject to project membership/role**. Project access tokens are project-scoped; GitLab.com currently requires Premium/Ultimate for project access tokens, self-managed/dedicated can offer them with any license.
2. **Roles:** Developer / Maintainer / Owner constrain API actions, MR merge and issue changes. Role-based authentication with broad `api` token is not restricted to only 'create MR' via token scope. A Developer-scoped bot with `api` can potentially do other Developer-allowed API operations (issue changes, comments etc.). To guarantee typed MR-only use a mediator whose credential is kept outside sandbox.
3. **Protected branches:** configure exact default `main` and release refs with `Allowed to push and merge = No one` (explicit, not unconfigured), and `Allowed to merge = Maintainers` or other human-only reviewers as appropriate. Ensure the bot is NOT in permitted role/user/group/deploy-key override. Other branches (e.g., `agent/*`) can remain writable by agent, or be protected with explicit allowed deploy key policies and force push disabled. Avoid overlapping wildcard rules granting unexpected access. A person allowed direct push to a protected branch can bypass MR approval workflows.
4. **Merge approvals and CI:** for Premium/Ultimate, configure required approvers / CODEOWNERS, prevent creator/committer approvals, prevent override of rules, reset approvals on new commits, required pipelines. Default protected-branch permissions should not delegate merges to bot. Merely 'MR requires approval' is not protection if the same credential can direct-push default branch.
5. **Server push rules:** Premium/Ultimate GitLab push rules support `commit_message_negative_regex`, branch name constraints, unsigned commit rejection and other pre-receive checks. Reject known `[skip ci]` / `[ci skip]` and issue closing keywords if desired; these are patterns, not a proof against all GitLab server-side automation. Self-managed custom hooks can be another privileged server-enforced layer but require admin support.
6. **Deploy-key creator:** a deploy key is associated with account privileges. GitLab explicitly notes the creator must be authorized for additional processes caused by the push, such as protected CI variables. Create under dedicated service account, not a developer's personal GitLab account. A deploy key may remain valid after owner is removed from project unless revoked; test lifecycle. Avoid specifically adding RW key as exception to protected `main`, because it can bypass otherwise broad 'No one' rules when allowlisted.

### Key choices and their real powers

| Credential | Clone/fetch | Git push | General writable REST API | Important caveat |
|---|---|---|---|---|
| Project RO deploy key | Yes | No | No | A local commit message has no server-side side effects without an authorized push or MR mutation |
| Project RW deploy key | Yes | Yes | No | Push options, CI, implicit closure effects; owner privileges matter |
| `read_repository` project token | Yes | No | No | No issues/MR modifications via Git push |
| `write_repository` project token | Yes | Yes | No | Accepting a push is still not a harmless write |
| Developer bot with `api` token | Yes per role/scope | Often yes | Yes, within Developer rights | Not a 'create-MR-only' credential |
| Trusted typed MR broker (hidden `api` token) | As configured | As configured | Only operations broker exposes to agent | Must isolate broker endpoint, token and process |

## Three deployment tiers

### A — pure read only (strongest isolation, less autonomy)

Expose **only** RO deploy key for Git fetch plus readonly GitLab MCP/token to the agent. It may edit, test and create local commits/worktrees but cannot push or create/merge an MR. An external human or trusted worker performs all server writes. CI scripts in agent sandbox still require independent isolation.

### B — autonomous feature branches (recommended pragmatic baseline)

Expose a **dedicated project RW deploy key** directly to isolated agent (or broker if desired) while strictly protecting `main` and releases, no merge permissions, service-account owner with minimal access, restricted CI secrets on unprotected refs, and an optional push rule against CI skip/closing text. Agent can push new commits to its feature branch without human consent **every time**. It cannot directly write protected default or merge there if GitLab permissions correctly enforce denial. But it **can** affect its own branch refs (including potentially deletes/force pushes, depending on settings), trigger CI, use push options (including MR creation/auto-merge attempt under its effective authority), and author text interpreted later on merge. This level is safe only if those residual effects are acceptable. GitLab alone does not provide a universal per-push-option scope on a RW deploy key.

### C — autonomous feature branches with trusted push/API broker (strongest fine-grained control)

Give model **RO deploy key only**; privileged RW deploy key and narrowly scoped `api` token stay **outside model sandbox**, in a separate host broker. Broker exposes typed `pushFeatureBranch(repoId,branch,newOid,expectedOldOid)` and `createMergeRequest(project,source,target,title,description)` after validation. Push broker uses an explicit fixed refspec, no implicit/explicit `-o` push options, force, tags, deletes, custom remote and config, and evaluates commit-message closing patterns + CI skip + dangerous file diffs before executing. The MR broker strips/refuses slash quick actions, CI-skip title directives, closing patterns in description (or explicitly authorizes their effects). Bot cannot ask broker to merge/change branch protections/close issues. This design enables unlimited authorized low-risk feature pushes and MR creation **without human approval each time**, while protected `main` remains merge-review only. Requires careful isolation and a new small broker; not a blanket GitLab MCP rewrite.

## Can `Closes #123` bypass credentials?

No, not by itself. GitLab docs say commit messages use **issue-closing patterns**, distinct from slash quick actions in issue/MR notes and descriptions. A commit message in a **local repo** or on a **feature branch** does not simply execute an issue close. On push/merge to the default branch GitLab may close referenced issues. GitLab checks permission to close targeted issues when the user merges. Cross-project references are supported, and manual work-item links can persist. A GitLab agent denied merge/default push cannot independently trigger that merge event, although it can plant a latent closing directive for later reviewer action.

A **read-only Git credential does not give REST API issue closure or MR creation**. A RW Git credential permits push options such as `merge_request.create`, `merge_request.auto_merge`, CI directives and secret/security protection bypass options, subject to GitLab's server-side user/project rights. Whether a specific option can succeed for a deploy key depends on GitLab/version/actor permissions and must be tested; do not assume all pushes with RW keys are allowed to auto-merge. GitLab's branch and approval enforcement is still authoritative.

## Quick actions and text surfaces

- Slash quick actions belong to descriptions/comments and commit **comments**; NOT commit messages. The commit-comment `/tag` creates a tag and is separate from push. GitLab official MCP note API rejects note lines starting with `/` to avoid command execution.
- Commit/MR descriptions can have closing patterns `Closes #123`; push to default/merge to default triggers closure where GitLab's rules and rights permit. Self-managed regex customization limits local static classifier guarantees.
- Commit message `[ci skip]` / `[skip ci]` can skip push CI. As documented for GitLab 19.5 (feature flag), MR title can skip MR pipelines. Neither can be controlled by an SSH deploy key scope alone. A server push rule or trusted broker must constrain commit message; a typed API MR broker must constrain titles.
- Push options can create/change/auto-merge MR, alter CI variables or skip CI. Static Pi command regex does not detect implicit config push.pushOption. Prefer broker forcing no options.
- An MR's description can contain quick actions when saved, and may contain closing patterns that act later. Text origin matters; do not treat all string write paths as benign.
- Normal branch push triggers CI execution under GitLab CI rules. Protect CI variables, environments, runners and sensitive credentials from untrusted feature branches and forks; protected branches alone do not prove CI safe.

## Configuration cookbook (must test actual GitLab instance)

1. Create service account with least required project role for feature branch contributions; never Maintainer/Owner unless absolutely necessary. Avoid private human account as deploy key owner.
2. Create a RO deploy key per project to agent sandbox. If choosing tier B, create RW key instead, understanding residual write/CI risks; if choosing C, store RW key only in privileged broker.
3. Protect default and release refs: explicit Allowed to push and merge = No one (or strictly identified human release authority); Allowed to merge = human Maintainers; **bot and deploy key are not exceptions**.
4. Use required MR reviews/pipeline checks; Premium/Ultimate CODEOWNERS and immutable approval rules where supported. Prevent the MR author from approving its own changes.
5. Restrict protected CI variables to protected refs; use safe runner/secret and branch permissions. Review whether untrusted branch CI can reach internal resources.
6. Optional GitLab push rules: reject commit messages with CI skip or closing patterns when policy requires; branch-name restrictions. They do not replace review.
7. In broker tier C, use separate API token for typed MR creation (not general agent API), and reject privileged quick-action text/auto-merge/CI skips by default.
8. Run an adversarial acceptance suite before unattended use: unauthorized main push, MR auto-merge push option, ci.skip, multi-issue closing, direct glab API, force/tag/delete, secrets via CI.

## Source documentation

- https://docs.gitlab.com/user/project/deploy_keys/
- https://docs.gitlab.com/security/tokens/access_token_scopes/
- https://docs.gitlab.com/user/project/settings/project_access_tokens/
- https://docs.gitlab.com/user/project/repository/branches/protected/
- https://docs.gitlab.com/user/project/repository/branches/protection_rules/
- https://docs.gitlab.com/user/project/merge_requests/approvals/settings/
- https://docs.gitlab.com/user/project/repository/push_rules/
- https://docs.gitlab.com/user/project/issues/managing_issues/
- https://docs.gitlab.com/user/project/quick_actions/
- https://docs.gitlab.com/topics/git/commit/
- https://docs.gitlab.com/ci/pipelines/
- https://docs.gitlab.com/user/model_context_protocol/mcp_server_tools/

## Additional implementation gate

Confirm bot effective permissions for **deploy-key Git push options** on the user's exact GitLab version. A general RW Git key is not fine-grained proof that push -o create/merge will be denied. The broker design assumes no -o option and separate API MR tool, because relying on server role behavior for every supported push option may be brittle.

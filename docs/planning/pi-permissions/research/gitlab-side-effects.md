# GitLab text commands, commit messages, Git push options and security boundaries
Date: 2026-10-10. Sources: official GitLab documentation (URLs below). Verified documentation statements are distinguished from experimental gaps; no live GitLab mutation performed.

## 1. Quick actions are NOT commit-message commands

[Official GitLab quick actions](https://docs.gitlab.com/user/project/quick_actions/) says commands beginning with slash on their own lines execute when issue/MR/work-item descriptions or notes are saved. The separate section **Commit comments** explicitly states commit quick actions work in **comments on individual commits**, **not commit messages**. The documented commit-comment quick action /tag creates a Git tag. Other applicable contexts vary per command and GitLab version/tier/roles. /merge is listed for merge requests, /close for issues/MRs; /run_pipeline can trigger a pipeline and can be combined with /merge. There are many state-altering actions beyond these.

**Consequence:** an agent writing a commit message containing a literal /merge should not cause an ordinary quick action merely by pushing the commit, according to current GitLab docs. Treat commit message and commit comment as different authorized surfaces. Do not overstate behavior across self-managed old versions; test version compatibility.

## 2. Closing patterns ARE a separate effect in commit messages and MR descriptions

[Closing issues automatically](https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically) says words like Closes/Fixes/Resolves/Implements followed by #123 or project/path#123 in **commit message or MR description** automatically close issues when **commit is pushed to default branch** or commit/MR is merged into default branch. Works for cross-project references. The GitLab closing regex can be customized by Self-Managed admins. The 'auto-close' project setting can be disabled, but docs explicitly warn it can **still close issues in another project**; pre-existing manual linked issues can also cause closing on merge. Initial push from existing repo is a documented exception. Current auto-merge may lock the set of auto-closed issues. Read upstream before assuming fixed regex.

**Security implication:** pushing benign code to a feature branch that contains a closing pattern is **not necessarily an immediate close**; it creates a **deferred side effect** that may happen when merged. Direct push to default branch may close issues immediately. A 'git push feature branch' grant is not equivalent to permission to close issues, and 'merge MR' approval must account for committed messages, MR descriptions and linked issues. Some deferred effects can be triggered later by OTHER actors; Pi is not the sole authorizer of project actions.

Illustrative crossing: a branch push contains `Closes other/project#45`; later merge to default branch can close issue in the other project if permissions permit. A project-scoped API grant that only approves 'write code to project A' cannot claim to prohibit all future cross-project side effects.

## 3. Git push options are server-side operations

[GitLab Git push options](https://docs.gitlab.com/topics/git/commit/#push-options) document:
- `merge_request.create`, `merge_request.target`, `merge_request.target_project`, `merge_request.title`, `merge_request.description`, labels, assign, draft, `merge_request.auto_merge`, remove source branch, squash.
- `ci.skip`, `ci.no_pipeline`, `ci.input`, `ci.variable`, `integrations.skip_ci`.
- `secret_push_protection.skip_all` and `security_policy.bypass_reason`.
- Push option values may encode newlines as backslash+n, which GitLab converts for descriptions. Unknown whether quick actions inside this generated MR description are executed in every supported GitLab version: **must test**; do not assume direct equivalence to ordinary MR update.
- Git configuration can supply default push options when none appear on the command line (see [Git push reference](https://git-scm.com/docs/git-push)). Restrict both explicit and implicit options in broker. CLI command-string inspection is insufficient.

**Security implication:** even `git push feature/x` may create/auto-merge an MR, change security posture or skip checks if push options are injected. Default reject **all** push options in broker; any supported option is a distinct typed operation with fresh effect classification and consent. Never pass arbitrary -o through.

## 4. GitLab's own MCP uses quick-action defense

[Official GitLab MCP tool docs](https://docs.gitlab.com/user/model_context_protocol/mcp_server_tools/) say **note body lines cannot start with '/'** to prevent quick actions such as /merge. This is a useful independent precedent. The existing `maxbog/gitlab-mcp` PR #2 classifier at [src/lib/elicitation.ts](https://github.com/maxbog/gitlab-mcp/blob/feature/scoped-sticky-approvals/src/lib/elicitation.ts) currently checks whether certain note tools are eligible for `mr.note.add` / `issue.note.add`; it does NOT, in the inspected classification code, enforce a whole-body no-command check before granting sticky reuse. The wider API handler path must also be examined for current validation, so this is a **confirmed classifier gap / potential exploit**, not a proven full bypass.

**Minimum rule for sticky note approval:** reject any line that *might* be interpreted as slash command. Conservative rule normalize newline boundaries then check trimmed-leading-whitespace slash lines; include input normalization, CRLF, code fences and Unicode edge cases. Unknown or ambiguous text => no sticky (fresh explicitly disclosed high-risk approval or hard reject). Prefer hard-deny slash-bearing notes in generic `create_note` and provide separately typed high-risk quick-action tool only after complete policy model. Include **all** comment and description write tools, not only named MR note endpoints.

**Quick-action privilege hierarchy:** Not all slash actions are equal. /label and /assign mutate metadata; /close closes; /approve alters review status; /merge may merge or enable auto-merge; /run_pipeline executes pipelines; /tag on commit comments creates tags; /clone and /create_merge_request create resources. Avoid a simplistic 'notes = benign write' classification. A grant allowing `mr.note.add` MUST NOT imply `mr.merge`, even if GitLab checks server-side role.

## 5. Other deferred side effects

- GitLab CI/CD may run on branch pushes (scripts and runners, sometimes protected variable access); modifications to .gitlab-ci.yml or included CI files can materially change outcomes.
- [GitLab deploy keys](https://docs.gitlab.com/user/project/deploy_keys/) document read-only/read-write modes and actor privileges for pushes, CI and protected branches. A read-only deploy key is a good sandbox fetch credential; writable push credential stays exclusively in trusted broker.
- [GitLab branch protection](https://docs.gitlab.com/user/project/repository/branches/protected/) and [protection rules](https://docs.gitlab.com/user/project/repository/branches/protection_rules/) should backstop human approvals. Branch rules may combine permissively; do not assume only exact rule wins.
- Existing push contents can include executable jobs or malicious code even with no special commit message. A whole-branch sticky push grant is inherently authorizing potential CI triggers.

## 6. Effects/permissions grid

| Origin | Surface | Default behavior | Sticky eligibility |
|---|---|---|---|
| GitLab MCP read | GET/list | read under server policy | no prompt |
| GitLab MCP normal note, no slash-like line | comment content | write new note | exact resource+operation session grant if API handler enforces no quick actions |
| GitLab MCP note with /close, /merge, /run_pipeline etc | content interpreted by GitLab | extra mutations | **never** reuse note grant; prefer reject and require separate typed action |
| MR/issue description with quick-action line | saved description | possible extra mutations | never reuse metadata-edit grant |
| Commit comment with /tag | commit note | creates tag | special privileged operation; not ordinary note |
| Commit message with Closes/Fixes | commit graph | deferred or immediate issue closing | classify at push/merge; note cross-project refs |
| git push feature branch, no -o | ref update + potential CI | ref write | possible session grant with explicit CI/deferred-effect caveat and protected-branch checks |
| git push main/default | default-branch ref update | CI + potential immediate issue closure | one-shot or denied by default; no broad sticky |
| git push -o merge_request.auto_merge | push + MR lifecycle | auto-merge etc | separate explicit high-risk approval; reject in MVP |
| git push -o ci.variable / ci.skip | CI behavior | pipeline variable/change or bypass | reject in MVP |
| merge MR via API/MCP | merge code, closes linked issues | compound mutation | one-shot with full effects/linked issues preview; NEVER a note grant |

## Open experimental gates

Q1: Do quick actions execute when MR description is passed through push options during MR creation vs via REST API? Test with disposable GitLab version(s), including slash in multi-line description.
Q2: Does the maxbog GitLab MCP server sanitize note bodies consistently in **all** note APIs, discussion replies, issue/MR description creation/update and commit comments? Inspect handler implementations.
Q3: Can repository hooks, automation and custom instance regex add additional effects? Document version/config-specific impossible-to-predict side effects and rely on GitLab-side restrictions.
Q4: Confirm closing behavior for merged commit history vs squash/merge commit message, cross-project targets, prelinked issues and auto-merge.
Q5: Test quick-action parsing with CRLF, leading whitespace, encoded text and fenced Markdown; classification must fail closed when uncertain.

No test here demonstrates a live exploit. Treat mechanisms as documented, and unknown cases as requiring a blocker ticket.

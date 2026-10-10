# Native Git and existing Pi sandbox/permission plugins — research (2026-10-10)

Sources:
- [Official Git push manual](https://git-scm.com/docs/git-push)
- [GitLab Git push options](https://docs.gitlab.com/topics/git/commit/#push-options)
- [GitLab deploy keys](https://docs.gitlab.com/user/project/deploy_keys/)
- [GitLab branch protection](https://docs.gitlab.com/user/project/repository/branches/protected/)
- [pi-permission-modes README](https://github.com/wynainfo/pi-permission-modes/blob/main/README.md) and [SECURITY.md](https://github.com/wynainfo/pi-permission-modes/blob/main/SECURITY.md)
- [pi-better-sandbox](https://github.com/1aboveio/pi-better-harness/blob/main/packages/pi-better-sandbox/README.md)
- [pi-sandbox Linux](https://github.com/jasonish/pi-extensions/blob/main/pi-sandbox/README.md)
- [Pi safety-guard caveats](https://github.com/Firstp1ck/pi-coding-agent-forge/blob/main/pi-extension-safety-guard/TECHNICAL.md)

## Existing solutions

- `pi-permission-modes` uses Anthropic sandbox-runtime, tree-sitter bash gate and Pi policy. Its source README states Linux bubblewrap and macOS sandbox-exec. SECURITY.md discloses several important limits: read containment is denylist-based, file tools are not OS-sandboxed, and **approved out-of-project commands may run unsandboxed**, thereby recovering user's full rights. Project settings tighten only. Good candidate for **local tool containment**, not privileged Git push authorization.
- `pi-better-sandbox` supports main/subagent profiles, guarded tools, protected paths and Git worktrees. Its own documentation notes local Git config/hooks can be dangerous and allowed external/trusted tools may cross sandbox enforcement boundaries. Use only after validating actual OS enforcement and exact policy.
- `@jasonish/pi-sandbox` is Linux + bubblewrap focused. Not first choice for macOS host without a VM.
- There are permission extensions with shell-command AST analysis; none replaces a credential-isolated broker when the agent is allowed to run arbitrary code.

## Real Git security boundary

Local Git operations (status/log/diff, add, commit, branch, worktree) mostly need no write remote credential. Fetch needs only a GitLab **read-only deploy key**. Push needs a **write credential** that MUST live in trusted host broker only, not agent `ssh-agent`, credential helper, `~/.gitconfig` or visible files. Agent should not invoke its own raw authenticated push. A project-scoped tool-call approval is not security if model shell retains arbitrary SSH/curl access.

## Why parsing 'git push ...' alone is insufficient

- Git config may supply `remote.<name>.push`, `push.default`, `remote.<name>.mirror`, `push.pushOption`, `url.*.pushInsteadOf`, `core.sshCommand`, credential helper or custom hook path.
- Command can update arbitrary refs, delete branches/tags, use `--all`, `--mirror`, `--tags`, `--force`, `--force-with-lease`, `--receive-pack`, remote URL other than approved.
- Even a feature branch push can trigger CI jobs, create/auto-merge MR via push options, and leave future issue-closing patterns in commits.
- Changes to git config and hooks, or project-controlled git attributes and filters, can execute commands inside a trusted host context if broker carelessly uses `git`. Never invoke git from shell with untrusted argv; execute fixed-path executable with argument array, fixed trusted remote, hostile config disabled, hooks disabled, env cleaned, no model-controlled process extensions.
- Never claim `--dry-run` or a local preflight guarantees GitLab effects are pure or atomic. Preflight analyzes exact proposed refs/object IDs; remote may change in between. Use explicit expected old SHA lease/non-force fast-forward checks and ref compare where available.
- Strictly reject any unrecognized push option and implicit push configuration. Keep safe default as **no -o push options**, single explicit `<oid>:refs/heads/<branch>` refspec, and no force/delete/tags without elevated approval.

## Proposed broker design

**Separate trusted Git push broker** (prefer a Pi extension tool calling broker over a full MCP implementation if Pi/host API is available; MCP only if reusable across multiple agents). Broker runs outside sandbox with write credential and fixed GitLab host/project mapping. It receives typed `PushProposal(repoId, branch, newOid, expectedOldOid, options=[])`, not raw shell. It:
1. Resolves trusted project identity (not mutable agent-supplied remote URL) and checks allowed target.
2. Resolves objects and commit graph from a read-only view of workspace's Git repo. Treat repo objects/config as untrusted; do not execute hooks, aliases or shell extensions. Stronger designs push a verified pack from a separate vetted staging checkout.
3. Inspects new commits since expectedOldOid and MR linked effects, checks commit messages for closing patterns (cross-project and customizable), CI config changes and push side effects, and creates an approval preview.
4. Requests Pi permission for **exact ref update and effect set**, e.g. feature branch for session; main/default/protected branches always one-shot/manual or deny.
5. Rechecks old SHA/identity/policy and sends a single explicit authenticated ref update with **no extra push options** via isolated credential, no arbitrary git config/hook execution; records known success/unknown status. No persistent grant on a failed push.
6. Enforces repo + ref identity on all repeats. An approved feature branch grant is not permission to write to another branch, push options, update tags, force, delete or change CI protection.
7. Requires separate types and approvals for tag create, MR auto-merge, release pushes, protected branch push, forced ref update or deletion.

For local Git commands, Pi sandbox/policy handles allowed workspace writes and asks for destructive local modifications (checkout -f, reset --hard, clean -fdx). Do not reimplement all local Git functions.

## Potential gaps

- Need demonstrate that broker's Git transport executable cannot execute project-supplied hooks/config/helpers or untrusted binaries. Pin Git version and test malicious repo config. Consider libgit2 or separate clean clone/staging area when OS execution safety is uncertain.
- Need detect all pushed commits (including multiple branches, merge history, rewritten commits) and deferred effects; tests for cross-project closing-pattern refs.
- Need determine whether GitLab CI policies on feature branches make whole-session push approval acceptable under user's org rules; when not, default to each push approval.
- Need separate readonly GitLab deploy key generation/revocation and repository trust bootstrap outside the agent sandbox.

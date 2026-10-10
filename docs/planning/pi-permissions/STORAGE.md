# Pi-owned grant storage and lifecycle

## Decision

Store session approvals in **Pi** via model-invisible `appendEntry` custom records. Reconstruct **the active lineage** from `ctx.sessionManager.getBranch()`. The MCP connection holds no sticky grants. Session lifetime, not network lifetime or a guessed 30-minute clock, bounds the grant. No disk-wide allowlist by default.

## Record types (draft; enforce schemas exactly)

~~~json
{
  "customType": "pi-permissions/grant-v1",
  "data": {
    "version": 1,
    "grantId": "uuid",
    "sessionId": "pi-session-id",
    "sourceCallId": "local-invocation-id",
    "scope": "resource_session",
    "key": {
      "serverFingerprint": "sha256",
      "instanceOrigin": "https://gitlab.example.com",
      "actorId": "17",
      "projectId": "1234",
      "resourceType": "branch",
      "resourceId": "feature/a",
      "operation": "file.create_update",
      "policyRevision": "v1",
      "toolName": null
    },
    "createdAt": "2026-10-10T00:00:00Z"
  }
}
~~~

~~~json
{
  "customType": "pi-permissions/revoke-v1",
  "data": {
    "version": 1,
    "sessionId": "pi-session-id",
    "revokeId": "uuid",
    "targetGrantIds": ["uuid"],
    "reason": "user-command"
  }
}
~~~

Store **no PAT, request bodies, prompt text, entire arguments, GitLab file contents, or other secrets**. Include only minimal resource identity and operation; redact even project names when unnecessary. Session JSONL file and Pi host trust are part of the trusted computing base.

## Reconstruction algorithm

1. On session startup/resume, `session_tree` navigation or session switch: increment local generation, invalidate pending human confirmations and in-flight reuse decisions.
2. Obtain `sessionId` and `getBranch()` **from the same bound session context**; if mismatch/error, disable automatic reuse.
3. Validate custom entry type, version, exact shape, sessionId and key components. Fold grant entries in parent-to-leaf order. Independently collect valid revoke tombstones by grantId from **all** session entries via `ctx.sessionManager.getEntries()`. Filter grants by this global, monotonic revoke set. Unknown/future versions must not grant permission.
4. Re-evaluate configured server fingerprint, live actor, GitLab instance and policyRevision before matching. Recompute state rather than trusting serialized `cachedAllowed` flags.
5. Treat a fork with a new sessionId as **no inherited grants**, even if copied custom entries occur in the fork's history. Within one session's tree, grants persist only on descended branches, not siblings without that ancestor.

## Pending selection and commit

Selection of `tool_session` or `resource_session` creates only an in-memory PENDING record attached to **exact toolCallId + connectionEpoch + PiSessionGeneration + requestNonce**. It does not authorize any unrelated call until success is confirmed.

After a successful (isError false, non-aborted, known final) linked GitLab operation, attempt `pi.appendEntry`. Only then expose the new grant in active matching state. If append fails or durability is uncertain, re-read the session branch and resolve by `grantId`; otherwise fail closed. A cancelled call or GitLab `isError` response does not persist it. An operation with side effects followed by an error is still an error for grant persistence.

## Revoke semantics and limitations

`/permissions list`: display safe summaries, source and allowed operation; `/permissions revoke <grant-id>`: append revoke event, immediately invalidate pending and active cache; `/permissions clear`: revoke all grants in active session lineage. Require a human command, not a model-facing tool that can silently revoke or approve. Revocation cannot undo a mutation already dispatched; race semantics should be reported.

**Pi conversation-tree behavior:** grant visibility follows the active path, but revocations are monotonic across the complete session file. A valid revoke tombstone is collected from `getEntries()` irrespective of ancestry. Therefore a revoked grant cannot reappear after switching sibling branches; reloading the same session re-reads tombstones. Test whether getEntries() includes all file entries in the installed Pi release. If it does not, block release and design an independent secure revocation ledger.

## Expiration

Default: no wall-clock TTL. A new Pi session/fork does not inherit. Resume of same Pi session restores. Identity, policy, config change invalidates grants regardless of age. Reconnection alone does not revoke. Cross-session persistent grants, 'allow forever', and repo-global wildcard grants are excluded from MVP unless an explicit security review approves them.

## Consistency tests

- Grant success across reconnect; no grant on failed mutation.
- Resume and tree/ancestor/sibling/fork transitions.
- Duplicate/out-of-order/revoked/unrecognized/tampered custom entries.
- Session switch during confirmation; late result/timeout/cancel cannot persist.
- Disk append failure/partial durability: fail closed.
- Same name different server config, host, GitLab principal, project numeric ID, protected branch or policy version.
- Multi-process stale sessions and existing adapter tool approvals must not accidentally confer GitLab semantic permissions.

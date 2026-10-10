# Pi ↔ adapter ↔ GitLab MCP authorization contract (draft v1)

This file specifies a **proposed private extension convention**, not a claim of current MCP-standard support. G0 must validate SDK and adapter feasibility. Unrecognized versions fail closed to ordinary one-shot human elicitation.

## Transport

A conforming GitLab server still sends a valid MCP `elicitation/create` form with a primitive flat schema and a readable message. An optional namespaced request `_meta["dev.maxbog/pi-permissions"]` conveys structured authorization data. Do not place credentials, file contents or secrets in metadata, messages or logs. `relatedRequestId` links nested request to original MCP tools/call but is not sufficient as a trusted identity **unless adapter verifies it against its connection-level in-flight registry**.

### Authorization intent: schema sketch

~~~json
{
  "protocol": "dev.maxbog/pi-permissions",
  "version": 1,
  "kind": "gitlab.mutation",
  "requestNonce": "random-call-unique-value",
  "policyRevision": "gitlab-approval-classifier/v1",
  "instance": {
    "apiOrigin": "https://gitlab.example.com",
    "principalId": "canonical-authenticated-gitlab-user-id",
    "authRealm": "stable-account-or-deployment-identity"
  },
  "target": {
    "projectId": "1234",
    "resourceType": "branch",
    "resourceId": "feature/my-change"
  },
  "operation": "file.create_update",
  "tool": "gitlab_push_files",
  "effects": [
    {"type": "file.update", "path": "src/a.ts"}
  ],
  "flags": {"force": false, "rename": false, "fileModeChange": false},
  "approvalEligibility": ["once", "tool_session", "resource_session"],
  "requestDigest": "sha256-of-canonical-actual-tool-and-args",
  "preview": "Update src/a.ts on feature/my-change in project 1234"
}
~~~

**Identity note:** `principalId`, canonical numeric project and API origin must be resolved by a **trusted server** from its actual authenticated request context, not client-supplied arguments. Pi checks configured server identity, expected project and actual call against this assertion; this is a trust relationship with the allowlisted server, not authentication of an arbitrary server.

## Signed? No, but bounded trust

Do not invent cryptographic security around ordinary text metadata. The adapter supplies trusted connection identity and correlated tool call from its internal registry. The server itself supplies operation semantics; only explicitly allowlisted GitLab MCP servers are eligible. Signature/HMAC adds little if the agent can read keys; credential isolation and transport ownership are the actual trust boundaries.

## Canonical matching key

`(grantFormatVersion, trustedServerConfigHash, transport/serverEndpointIdentity, GitLab apiOrigin, principalId/authRealm, GitLab numeric projectId, resourceType, resourceId, operation, policyRevision, optional exact toolName, optional explicit path constraint)`.

- Validate scheme/host/port and canonical URL; normalize default port and path only as specified, never conflate independent GitLab deployments behind different configured server identities.
- Normalize numeric project IDs rather than relying on mutable display path aliases. If resolution fails, no sticky approval.
- Resource IDs are namespaced: branch exact ref; MR/issue numeric IID **plus** project.
- No wildcard project/instance/principal. No case folding for Git branch names or file paths.
- The tool-session grant additionally includes original tool name; resource-session grant covers only tools approved as semantically equivalent for that operation.
- `requestDigest` must cover all effective arguments and relevant normalized effect flags, not a server-provided digest accepted without recomputation at the adapter/plugin boundary.
- Hash the configured effective server definition incl target endpoint/config revision, but do not persist credential secrets. Detect token rotation/principal switch by verified authenticated actor identity.

## Scope and safety normalization

Every recognized write maps to an explicit allowlisted operation and a *complete* effect set. Reject duplicate JSON keys, invalid percent-encoding, ambiguous paths, malformed refs, mixed privilege batch operations and unknown writable fields as sticky candidates. Batch grants need to authorize all effects, not only the first one.

Any of these force one-shot approval (or deny under host policy):
- Delete or admin, GraphQL mutation/alias, force push, chmod including `execute_filemode=false`, move/rename, branch creation, retarget, merge, close/reopen, arbitrary quick actions, partial/unparsed batch effects.
- Unknown or new tool version/tool capabilities; hidden related side effects; unparseable project/actor/instance identity.

The host may display optional path-constrained scope only if server proves paths and file changes, checks every affected path, and has a stable published schema. No arbitrary lists of supposedly safe filenames.

## On-wire form (illustrative)

~~~json
{
  "mode": "form",
  "message": "Approve a GitLab write to project 1234, branch feature/my-change? ...",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "confirm": {"type": "boolean", "title": "Approve this one invocation"}
    },
    "required": ["confirm"]
  },
  "_meta": {"dev.maxbog/pi-permissions": {"version": 1, "requestNonce": "...", "intent": {}}}
}
~~~

The complete normalized intent should be supplied according to validated SDK support. The **wire response** always approves only the current invocation, e.g. `{action:"accept",content:{confirm:true}}`; the server never knows whether Pi also recorded a session-grant selection. A declined/cancelled/malformed response causes no mutation.

## Correlation and outcome

Adapter emits nested hook envelope: effective server origin/config fingerprint, principal/connection epoch, original tool call identifier and arguments or validated digest, nested request ID, abort signal, safe JSON snapshot, generation. Each outstanding invocation has an unguessable internal correlation entry bound to the actual connection and cancellation token; zero or multiple matches => no auto-grant.

Adapter emits outcome: original call ID, final MCP isError, result status, cancellation/timeout/unknown status and Pi session generation. Only a successful confirmed result and intact generation allow the Pi plugin to append a pending grant. A prompt answer alone is never considered execution success.

Multiple simultaneous nested elicitations MUST be demultiplexed; the same request must never commit the same grant twice; late responses after session switch are cancelled.

## Capability negotiation and compatibility

- GitLab reads work without elicitation. GitLab writes under `ask` need form elicitation support.
- A normal MCP client can always use one-shot human confirmation if it supports form, regardless of private `_meta`.
- A trusted Pi extension may automatically satisfy only validated tagged authorization forms. Unknown tags/versions/sources fall back to ordinary interactive handling; in headless mode deny.
- URL elicitation, arbitrary forms, sampling and MCP UI permissions must not inherit this grant.

## Version evolution

V1 supports only explicit enumerated effects and scope types. Additive new fields must be non-authoritative; unknown `operation`, `flags` or policyRevision cannot match existing grants. Breaking schema changes require a new major `version` and new conformance fixtures.

## Mandatory verification

G0 must show exact SDK support for transmitting and receiving request metadata/correlation. If not possible, propose the smallest upstream change and keep MVP in human per-call mode until proven. Do not implement an unsafe string-parsing fallback.

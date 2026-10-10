# Test plan — Pi Permissions

Date: 2026-10-10. These are proposed test cases, not tests already executed.

## Test layers

- Unit: GitLab effect classification, path and identity normalization, intent version validation, grant matcher, grant/revoke folding, policy defaults. Property tests for unexpected arguments and identity separation.
- Contract: GitLab standard form elicitation, optional namespaced metadata, correlation back to the actual in-flight call, response schema validation. Confirm actual SDK behavior at G0.
- Component: a fake Pi session tree, controlled UI dialogs, linked call outcomes, abort signals, replay and concurrent request handling.
- Integration: real GitLab MCP stdio server + actual Pi adapter + fake GitLab HTTP API; success, failure, delay, disconnect, resume. Separately sessionful Streamable HTTP.
- Sandbox: actual model-driven shell cannot access host Pi session log, write-capable PAT or privileged MCP process/socket.

## Mandatory acceptance matrix

| Test | Situation | Expected |
|---|---|---|
| T01 | Read in ask mode | No prompt, normal server read policy |
| T02 | Known write, allow once | One human approval; exactly one API mutation; no grant |
| T03 | Known write, select resource session | Persist only after confirmed successful mutation |
| T04 | Second matching call | New server elicitation automatically answered by Pi; no new human prompt |
| T05 | Different Git branch | Fresh prompt |
| T06 | Different numeric project | Fresh prompt |
| T07 | Different GitLab instance or account | Fresh prompt |
| T08 | Tool scope / another equivalent tool | Tool scope denies reuse; resource scope may allow under known equivalence |
| T09 | Delete, admin, merge, close, GraphQL | One-shot only / deny |
| T10 | MR/issue note with /close or /merge quick action | Cannot reuse comment grant |
| T11 | execute_filemode true OR false, force, move, start_branch | Cannot reuse normal file grant |
| T12 | Mixed create/update/delete batch | Cannot reuse benign grant |
| T13 | Failed write after selecting sticky | No grant |
| T14 | Cancel before GitLab dispatch | No API mutation and no grant |
| T15 | Cancel after dispatch, uncertain result | No grant; report uncertain outcome |
| T16 | Client has no form elicitation | Write denied; read unaffected |
| T17 | Headless with no prior trusted authorization | Deny |
| T18 | Unrelated form elicitation | Existing manual UI; never auto-approve |
| T19 | URL elicitation | Separate explicit consent; never auto-approve |
| T20 | Resume same Pi session across MCP reconnect | Grant restored if identity/policy match |
| T21 | New or forked Pi session | No grant inherited |
| T22 | Switch Pi session tree to sibling without grant | No reuse |
| T23 | Revoke on one sibling, switch to other with old grant | Global tombstone prevents resurrection |
| T24 | Revoke while UI prompt is open | No late grant |
| T25 | Two parallel writes and out-of-order elicitation | Exact tool/nonce binding, zero crossed approvals |
| T26 | appendEntry fails or partially succeeds | Verify re-read or fail closed; no phantom approval |
| T27 | Unknown contract version or effect flag | No automatic reuse |
| T28 | Direct, proxy, mcpScript/codemode, iframe and runtime calls | Same authorization semantics |
| T29 | Agent tries to read PAT, session state or privileged MCP socket | OS sandbox denies |
| T30 | Batch partially succeeds then errors | No grant; accurate error report |
| T31 | Branch-wide approval reaches CI/config files | Clear warning; optional path scope must constrain all effected paths |
| T32 | Config or token/principal changes on reconnect | Invalidate old grant |
| T33 | Replayed nonce, duplicate nested request | No duplicate approval or grant |
| T34 | Untrusted server forges authorization metadata | Human normal prompt/deny, never auto |
| T35 | Stored grant from earlier policy revision | Requires new approval |
| T36 | Session shutdown during UI | Cancel pending and never persist |
| T37 | Protected/default Git branch | Host policy blocks inappropriate broad grant; GitLab ACL still enforced |
| T38 | Project display path alias resolves to different numeric ID | Different identity; no reuse |
| T39 | Successful invocation but Pi persistence storage unavailable | Safe fail-closed for future calls |
| T40 | Manual one-shot via non-Pi MCP client | Standard protocol still works |

## Harness and fixtures

1. HTTP stub captures method, path, body and timestamps; configurable errors and delayed operations.
2. MCP transport fixture can send concurrent nested elicitation, disconnect, cancellation and malformed messages.
3. Pi fake tree with parent pointers, forks and session reload; supports getBranch, getEntries and appendEntry fault injection.
4. Each GitLab mutation tool has declarative expected effect type and negative cases; validate the entire tool catalog against coverage.
5. Capture no tokens, file contents or sensitive payloads in golden snapshots.
6. Matrix executes against pinned Pi and adapter versions and Node 24 in CI where supported.

## Release gates

G0: protocol metadata/correlation is proven; G1: adapter hook covers every tool origin; G2: cancellation semantics documented and tested; G3: GitLab mutation inventory and negative tests complete; G4: sandbox keeps credentials and Pi state protected. Security tests S1–S7 in SECURITY.md mandatory. If any gate fails, do not enable automatic sticky reuse; retain manual per-call ask behavior.

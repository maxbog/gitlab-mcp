# AWS permissions feasibility research (2026-10-10)

Sources:
- [AWS Agent Toolkit quick start](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/quick-start.html)
- [AWS MCP server and IAM](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/security_iam_service-with-iam.html)
- [AWS multi-profile MCP](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/multi-account-access.html)
- [AWS action authorization reference](https://docs.aws.amazon.com/service-authorization/latest/reference/reference_policies_actions-resources-contextkeys.html)
- [IAM action access levels](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_understand-policy-summary-access-level-summaries.html)
- [STS AssumeRole session policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-api.html)
- [Agent Toolkit overview](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/what-is-agent-toolkit.html)

## Source observations

1. AWS provides a **managed AWS MCP Server** via Agent Toolkit with SigV4 or OAuth; agents can access authenticated AWS APIs and `run_script` executing Python. Existing SDK/MCP offers broad API surface, so **do not build an AWS API reimplementation** without a proved gap.
2. AWS MCP Server enforces service-level IAM permissions downstream. Older MCP-only `aws-mcp:CallReadOnlyTool` / `aws-mcp:CallReadWriteTool` preview permissions are **deprecated and ineffective**; do not build policy on them. IAM context keys `aws:ViaAWSMCPService` and `aws:CalledViaAWSMCP` can distinguish AWS-managed MCP requests.
3. AWS officially supports multi-profile configuration via `AWS_MCP_PROXY_PROFILES`, explicit allowlist, per-call account identity, and recommends a readonly default with manual client-side approval for write profile.
4. IAM service authorization reference categorizes actions **List**, **Read**, **Tagging**, **Write**, **Permissions management**. Use published action taxonomy and dependency mapping, not CLI verb `get/list` regex. Managed ReadOnlyAccess is a policy choice, not proof against secret exfiltration, cost and service-specific semantics. A read operation can still expose sensitive data.
5. STS AssumeRole session policies **restrict** but never enlarge role permissions: final rights are intersection of role policies and session policies (and boundaries/SCPs etc). Temporary credentials have lifetimes; avoid promising ephemeral approval equates to single-use authorization.
6. `run_script` permits a model-generated Python program to call many APIs. **Do not allow RW AWS credentials into this tool** under a supposedly per-operation approval. A one-off script may hide many write effects. Same for direct `aws` CLI in an untrusted model shell.

## Recommended architecture

### Baseline read-only, existing tooling retained

- Pi uses **official AWS MCP Server** with dedicated least-privilege read IAM role/profile. Credential signing/proxy runs in trusted Pi host context outside model shell/sandbox; verify launch behavior in integration test. Expose only named approved profiles. Prevent agent from using direct AWS profile filesystem or environment and from selecting broader profiles.
- Default Pi permission category `aws.read` auto-allow for authorized list/read actions, but data sensitivity, cost and pagination require separate host policy where relevant; deny access to secrets/config sensitive APIs unless explicitly allowed.
- AWS's own IAM denial is authoritative even if Pi classifies an operation incorrectly. Classifier is advisory only until independently backed by IAM restrictions.
- If AWS MCP `run_script` is offered to read-only profile, IAM still prevents unauthorized writes, but do not describe it as a pure read-specific tool. Limit risk by cost/time/resource and audit, or disable `run_script` for production contexts.

### Elevated writes (new minimal broker component, only if required)

- Prefer a **Pi permission broker/extension** that obtains a narrowly scoped role/session only **after** human approval of typed operations. It must itself execute exact AWS SDK calls inside trusted process, never return credentials to model shell or generic `run_script`/MCP client; validate account, region, ARN, operation, effective parameter set and policy.
- Alternative use AWS MCP with dedicated write profile and Pi's full nested tool approval if independent tool arguments and call provenance are known, but this is weaker for code-execution tools; acceptable only after G0/permission semantics verified and with service IAM least-privilege explicit allowlists. Never grant `sts:AssumeRole` or unrestricted `iam:PassRole` to model credentials.
- Use STS session policies as **additional restriction** when platform allows a designated role, not as substitute for Pi approval. For fine-grained single-operation guarantees, broker serializes exactly one typed AWS SDK command against strict allowlist.
- Track e.g. `aws.ec2.stop_instances`, `aws.lambda.update_function_code`, `aws.s3.put_object` with (account, region, service, IAM action, ARN set, conditions) as matching key. Wildcard resource grants, privilege management, IAM role/policy modifications, resource deletion and secret access once-only/deny by default.

## Decision table

| Capability | Use existing | Add |
|---|---|---|
| AWS docs/discovery | Agent Toolkit skills / AWS MCP | nothing |
| Read-only AWS APIs | AWS MCP with IAM Read/List role and profile allowlist | optional policy/intent wrapper for sensitive reads |
| Low-risk specific writes | AWS SDK in trusted broker, or verified narrowly constrained MCP tool | Pi approval and typed execution broker if AWS MCP cannot enforce exact effects |
| Arbitrary RW script | NO by default | no generic 'script approved' sticky scope |
| Region/account switching | official MCP multi-profile when safe | canonical Pi identity checks and profile allowlist |
| AWS CLI from agent shell | not trusted write access | sandbox keeps config/env/credential_process and network signing endpoints hidden |

## Needed evidence before implementation

- Exact AWS MCP tools/SDK payloads (especially `run_script`) and whether Pi adapter can intercept per-operation without breaking managed service contract.
- Pin versions of AWS proxy; test profile allowlist and account/region identity.
- AWS IAM read-only profile review, secrets/cost controls, STS session policy + SCP/role boundary, CloudTrail audit.
- Confirm credential isolation from user sandbox, incl unix sockets, metadata services, environment and credential_process.

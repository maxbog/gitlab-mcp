import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { GitLabToolDefinition } from "../tools/gitlab.js";

type ToolArgs = Record<string, unknown>;
type ApprovalChoice = "once" | "tool_session" | "resource_session";
type StickyOperation =
  | "file.create_update"
  | "mr.note.add"
  | "mr.metadata.edit"
  | "issue.create"
  | "issue.note.add"
  | "issue.metadata.edit";

interface ApprovalIntent {
  projectId: string;
  resourceType: "branch" | "merge_request" | "issue" | "project";
  resourceId: string;
  operation: StickyOperation;
  description: string;
}

export interface ApprovalGrant {
  choice: Exclude<ApprovalChoice, "once">;
  toolName: string;
  intent: ApprovalIntent;
}

const APPROVAL_LABELS: Record<ApprovalChoice, string> = {
  once: "Allow this call once",
  tool_session: "Allow this operation with this tool for this session",
  resource_session: "Allow this operation on this branch/MR for this session"
};

// Only show identifiers, never file contents, MR/issue bodies, CI variables, tokens, etc.
const VISIBLE_ARGUMENTS = [
  "project_id",
  "target_project_id",
  "group_id",
  "issue_iid",
  "merge_request_iid",
  "source_branch",
  "target_branch",
  "branch",
  "file_path",
  "ref"
] as const;

export class ToolApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolApprovalError";
  }
}

/**
 * Constructed once per McpServer, not per tool call or shared HTTP application:
 * grants never cross MCP connections. They last until disconnect and are never persisted.
 */
export class ApprovalManager {
  private grants: ApprovalGrant[] = [];

  async authorize(
    server: McpServer,
    tool: GitLabToolDefinition,
    args: ToolArgs,
    relatedRequestId: string | number,
    allowedProjectIds: readonly string[] = []
  ): Promise<ApprovalGrant | undefined> {
    const intent = classifyForStickyApproval(tool, args, allowedProjectIds);

    if (intent && this.grants.some((grant) => matchesGrant(grant, tool.name, intent))) {
      return undefined;
    }

    if (!server.server.getClientCapabilities()?.elicitation?.form) {
      throw new ToolApprovalError(
        "GitLab operation blocked: the MCP client does not support form elicitation."
      );
    }

    // Destructive, administrative and unclassifiable calls can only be approved once.
    const choices: ApprovalChoice[] = ["once"];
    if (intent) {
      choices.push("tool_session");
      if (intent.resourceType === "branch" || intent.resourceType === "merge_request") {
        choices.push("resource_session");
      }
    }

    const descriptions = [
      "once: allow only this call",
      ...(choices.includes("tool_session")
        ? [
            "tool_session: allow this operation via " +
              tool.name +
              " on " +
              describeIntent(intent!) +
              " until this MCP connection ends"
          ]
        : []),
      ...(choices.includes("resource_session")
        ? [
            "resource_session: allow " +
              describeIntent(intent!) +
              " across eligible GitLab tools until this MCP connection ends"
          ]
        : [])
    ];
    const action = tool.capabilities.includes("delete")
      ? "delete"
      : tool.capabilities.includes("admin")
        ? "administrative"
        : "write";
    const identifiers = VISIBLE_ARGUMENTS.flatMap((key) => {
      const value = args[key];
      return typeof value === "string" || typeof value === "number"
        ? [key + ": " + clean(value)]
        : [];
    });
    const changes = fileChangesForPreview(tool.name, args);
    if (changes.length > 10) {
      changes.length = 10;
      changes.push("(remaining file actions omitted)");
    }
    const message = [
      "Approve GitLab " + action + " operation: " + tool.name + "?",
      ...identifiers,
      ...(changes.length ? ["File changes:", ...changes] : []),
      "",
      "Approval scopes:",
      ...descriptions,
      "",
      "Review the full tool arguments. This approval grants no access to other projects or resources."
    ].join("\n");

    let response: Awaited<ReturnType<typeof server.server.elicitInput>>;
    try {
      response = await server.server.elicitInput(
        {
          mode: "form",
          message,
          requestedSchema: {
            type: "object",
            properties: {
              approval: {
                type: "string",
                title: "Approval scope",
                enum: choices.map((choice) => APPROVAL_LABELS[choice])
              },
              confirm: {
                type: "boolean",
                title: "I approve this GitLab operation"
              }
            },
            required: ["approval", "confirm"]
          }
        },
        { relatedRequestId }
      );
    } catch {
      throw new ToolApprovalError(
        "GitLab operation blocked: elicitation failed or is unavailable."
      );
    }

    if (response.action !== "accept" || response.content?.confirm !== true) {
      throw new ToolApprovalError("GitLab operation blocked: approval declined or not confirmed.");
    }

    const selected = choices.find(
      (choice) => APPROVAL_LABELS[choice] === response.content?.approval
    );
    if (!selected) {
      throw new ToolApprovalError("GitLab operation blocked: invalid approval scope.");
    }
    if (selected === "once") {
      return undefined;
    }
    if (!intent) {
      throw new ToolApprovalError("GitLab operation blocked: sticky approval unavailable.");
    }

    // The caller remembers the grant ONLY after the GitLab handler succeeds.
    return {
      choice: selected,
      toolName: tool.name,
      intent
    };
  }

  remember(grant: ApprovalGrant | undefined): void {
    if (!grant) {
      return;
    }
    this.grants = this.grants.filter(
      (existing) =>
        !(
          existing.choice === grant.choice &&
          existing.toolName === grant.toolName &&
          sameIntent(existing.intent, grant.intent)
        )
    );
    this.grants.push(grant);
  }

  listGrants(): readonly ApprovalGrant[] {
    return this.grants.map((grant) => ({
      ...grant,
      intent: { ...grant.intent }
    }));
  }

  clear(): void {
    this.grants = [];
  }
}

function matchesGrant(grant: ApprovalGrant, toolName: string, intent: ApprovalIntent): boolean {
  return (
    sameIntent(grant.intent, intent) &&
    (grant.choice === "resource_session" || grant.toolName === toolName)
  );
}

function sameIntent(a: ApprovalIntent, b: ApprovalIntent): boolean {
  return (
    a.projectId === b.projectId &&
    a.resourceType === b.resourceType &&
    a.resourceId === b.resourceId &&
    a.operation === b.operation
  );
}

function describeIntent(intent: ApprovalIntent): string {
  return (
    intent.operation.replaceAll(".", " ") +
    " in project " +
    intent.projectId +
    (intent.resourceType === "project"
      ? ""
      : " on " + intent.resourceType.replace("_", " ") + " " + intent.resourceId)
  );
}

function isControlCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
}

function clean(value: string | number): string {
  return Array.from(String(value))
    .map((character) => (isControlCharacter(character) ? " " : character))
    .join("")
    .slice(0, 160);
}

function projectIdFor(args: ToolArgs, allowedProjects: readonly string[]): string | undefined {
  const explicit = args.project_id;
  if ((typeof explicit === "string" && explicit.length > 0) || typeof explicit === "number") {
    return String(explicit);
  }
  return allowedProjects.length === 1 ? allowedProjects[0] : undefined;
}

function key(args: ToolArgs, field: string): string | undefined {
  const value = args[field];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function hasOnlyChanges(
  args: ToolArgs,
  permitted: readonly string[],
  required: readonly string[]
): boolean {
  const present = Object.keys(args).filter(
    (item) => args[item] !== undefined && args[item] !== null
  );
  return (
    present.every((item) => permitted.includes(item)) &&
    required.some((item) => present.includes(item))
  );
}

interface FileChange {
  path: string;
  action: "create" | "update";
}

/**
 * Validate path syntax only. No file-name denylist: a branch grant expressly
 * allows file creates/updates anywhere on the selected branch, including CI
 * and configuration files. GitLab remains the authority on repository paths.
 */
function isUnambiguousRepositoryPath(path: unknown): path is string {
  if (
    typeof path !== "string" ||
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    Array.from(path).some(isControlCharacter) ||
    /%(?:2e|2f|5c)/i.test(path)
  ) {
    return false;
  }
  return path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function fileChangesForPreview(tool: string, args: ToolArgs): string[] {
  if (tool === "gitlab_create_or_update_file") {
    return args.file_path === undefined ? [] : ["create/update " + clean(String(args.file_path))];
  }
  if (tool !== "gitlab_push_files") {
    return [];
  }
  const actions =
    Array.isArray(args.actions) && args.actions.length
      ? args.actions
      : Array.isArray(args.files)
        ? args.files
        : [];
  return actions.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }
    const item = value as Record<string, unknown>;
    const path = item.file_path;
    if (typeof path !== "string") {
      return [];
    }
    const action = typeof item.action === "string" ? item.action : "create";
    return [clean(action) + " " + clean(path)];
  });
}

function eligibleFileChanges(tool: string, args: ToolArgs): FileChange[] | undefined {
  if (args.force === true || args.start_branch || args.author_name || args.author_email) {
    return undefined;
  }

  if (tool === "gitlab_create_or_update_file") {
    if (
      args.previous_path ||
      args.execute_filemode === true ||
      !isUnambiguousRepositoryPath(args.file_path)
    ) {
      return undefined;
    }
    return [{ path: args.file_path, action: "update" }];
  }
  if (tool !== "gitlab_push_files") {
    return undefined;
  }

  const actions = args.actions;
  if (Array.isArray(actions) && actions.length > 0) {
    const changes: FileChange[] = [];
    for (const value of actions) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return undefined;
      }
      const item = value as Record<string, unknown>;
      if (
        (item.action !== "create" && item.action !== "update") ||
        !isUnambiguousRepositoryPath(item.file_path) ||
        item.previous_path ||
        item.execute_filemode === true
      ) {
        return undefined;
      }
      changes.push({ path: item.file_path, action: item.action });
    }
    return changes;
  }

  const files = args.files;
  if (!Array.isArray(files) || files.length === 0) {
    return undefined;
  }
  const changes: FileChange[] = [];
  for (const value of files) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    const path = (value as Record<string, unknown>).file_path;
    if (!isUnambiguousRepositoryPath(path)) {
      return undefined;
    }
    changes.push({ path, action: "create" });
  }
  return changes;
}

/** Allowlist only operations with predictable, narrowly scoped effects. */
export function classifyForStickyApproval(
  tool: Pick<GitLabToolDefinition, "name" | "capabilities">,
  args: ToolArgs,
  allowedProjects: readonly string[] = []
): ApprovalIntent | undefined {
  // GraphQL, administration and destruction are deliberately never sticky.
  if (
    tool.capabilities.some(
      (capability) => capability === "delete" || capability === "admin" || capability === "graphql"
    )
  ) {
    return undefined;
  }
  const projectId = projectIdFor(args, allowedProjects);
  if (!projectId) {
    return undefined;
  }

  if (tool.name === "gitlab_push_files" || tool.name === "gitlab_create_or_update_file") {
    const branch = key(args, "branch");
    const files = eligibleFileChanges(tool.name, args);
    if (!branch || !files?.length) {
      return undefined;
    }
    return {
      projectId,
      resourceType: "branch",
      resourceId: branch,
      operation: "file.create_update",
      description: "Create/update repository files on this branch"
    };
  }

  const mr = key(args, "merge_request_iid");
  if (mr) {
    if (
      (tool.name === "gitlab_create_merge_request_note" ||
        tool.name === "gitlab_create_merge_request_discussion_note") &&
      !args.created_at
    ) {
      return {
        projectId,
        resourceType: "merge_request",
        resourceId: mr,
        operation: "mr.note.add",
        description: "Add notes to this merge request"
      };
    }
    if (
      tool.name === "gitlab_update_merge_request" &&
      hasOnlyChanges(
        args,
        ["project_id", "merge_request_iid", "title", "description"],
        ["title", "description"]
      )
    ) {
      return {
        projectId,
        resourceType: "merge_request",
        resourceId: mr,
        operation: "mr.metadata.edit",
        description: "Edit title/description of this merge request"
      };
    }
  }

  if (tool.name === "gitlab_create_note" && key(args, "noteable_type") === "merge_request") {
    const iid = key(args, "noteable_iid");
    if (iid) {
      return {
        projectId,
        resourceType: "merge_request",
        resourceId: iid,
        operation: "mr.note.add",
        description: "Add notes to this merge request"
      };
    }
  }

  if (tool.name === "gitlab_create_issue") {
    return {
      projectId,
      resourceType: "project",
      resourceId: projectId,
      operation: "issue.create",
      description: "Create issues in this project"
    };
  }

  const issue = key(args, "issue_iid");
  if (issue) {
    if (tool.name === "gitlab_create_issue_note" && !args.created_at && !args.discussion_id) {
      return {
        projectId,
        resourceType: "issue",
        resourceId: issue,
        operation: "issue.note.add",
        description: "Add notes to this issue"
      };
    }
    if (
      tool.name === "gitlab_update_issue" &&
      hasOnlyChanges(
        args,
        ["project_id", "issue_iid", "title", "description", "full_response"],
        ["title", "description"]
      )
    ) {
      return {
        projectId,
        resourceType: "issue",
        resourceId: issue,
        operation: "issue.metadata.edit",
        description: "Edit title/description of this issue"
      };
    }
  }

  return undefined;
}

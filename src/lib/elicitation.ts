import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { GitLabToolDefinition } from "../tools/gitlab.js";

type ToolArgs = Record<string, unknown>;

// Only display identifying arguments. Never include API tokens, request bodies,
// variable values, or arbitrary tool arguments in a confirmation prompt.
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
 * Request explicit consent for a mutation via MCP form elicitation.
 * No approval is cached and all failures deny the operation.
 */
export async function requestToolApproval(
  server: McpServer,
  tool: GitLabToolDefinition,
  args: ToolArgs,
  relatedRequestId: string | number
): Promise<void> {
  if (!server.server.getClientCapabilities()?.elicitation) {
    throw new ToolApprovalError(
      "GitLab operation blocked: the MCP client does not support elicitation."
    );
  }

  const identifiers = VISIBLE_ARGUMENTS.flatMap((key) => {
    const value = args[key];
    if (typeof value !== "string" && typeof value !== "number") {
      return [];
    }
    const safeValue = String(value).replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 120);
    return [`${key}: ${safeValue}`];
  });
  const action = tool.capabilities.includes("delete")
    ? "delete"
    : tool.capabilities.includes("admin")
      ? "administrative"
      : "write";

  let response: Awaited<ReturnType<typeof server.server.elicitInput>>;
  try {
    response = await server.server.elicitInput(
      {
        mode: "form",
        message: [
          `Approve GitLab ${action} operation: ${tool.name}?`,
          ...identifiers,
          "Check the tool arguments before approving. This action will use your GitLab credentials."
        ].join("\n"),
        requestedSchema: {
          type: "object",
          properties: {
            confirm: {
              type: "boolean",
              title: "I approve this GitLab operation"
            }
          },
          required: ["confirm"]
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
    throw new ToolApprovalError(
      `GitLab operation blocked: approval ${response.action === "accept" ? "not confirmed" : response.action}.`
    );
  }
}

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../../src/server/build-server.js";
import { buildContext } from "./_helpers.js";

type Choice = "once" | "tool_session" | "resource_session";

const CHOICE_LABELS: Record<Choice, string> = {
  once: "Allow this call once",
  tool_session: "Allow this operation with this tool for this session",
  resource_session: "Allow this operation on this branch/MR for this session"
};

async function setup(
  responseChoice: (message: string) => Choice,
  allowedProjectIds: string[] = []
) {
  const createOrUpdateFile = vi.fn().mockResolvedValue({ file_path: "ok" });
  const pushFiles = vi.fn().mockResolvedValue({ id: "commit-123" });
  const createMergeRequestNote = vi.fn().mockResolvedValue({ id: 12 });
  const createNote = vi.fn().mockResolvedValue({ id: 13 });
  const updateMergeRequest = vi.fn().mockResolvedValue({ iid: 42 });
  const createIssue = vi.fn().mockResolvedValue({ iid: 9 });
  const context = buildContext({
    permissionMode: "ask",
    allowedProjectIds,
    gitlabStub: {
      createOrUpdateFile: createOrUpdateFile as never,
      pushFiles: pushFiles as never,
      createMergeRequestNote: createMergeRequestNote as never,
      createNote: createNote as never,
      updateMergeRequest: updateMergeRequest as never,
      createIssue: createIssue as never
    }
  });
  const server = createMcpServer(context);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "sticky-approval-test-client", version: "1.0" },
    { capabilities: { elicitation: { form: {} } } }
  );
  const prompts: string[] = [];
  client.setRequestHandler(ElicitRequestSchema, async (request) => {
    prompts.push(request.params.message);
    return {
      action: "accept" as const,
      content: {
        confirm: true,
        approval: CHOICE_LABELS[responseChoice(request.params.message)]
      }
    };
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    prompts,
    createOrUpdateFile,
    pushFiles,
    createMergeRequestNote,
    createNote,
    updateMergeRequest,
    createIssue,
    async close() {
      await client.close();
      await server.close();
    }
  };
}

function file(branch: string, project = "team/backend", path = "src/one.ts") {
  return {
    name: "gitlab_create_or_update_file",
    arguments: {
      project_id: project,
      branch,
      file_path: path,
      content: "export const secret = 'do not include in prompt';",
      commit_message: "update file"
    }
  };
}

function push(
  branch: string,
  actions: Array<{ action: "create" | "update" | "delete" | "move" | "chmod"; file_path: string }>,
  project = "team/backend",
  force = false
) {
  return {
    name: "gitlab_push_files",
    arguments: {
      project_id: project,
      branch,
      actions,
      force,
      commit_message: "commit"
    }
  };
}

describe("MCP sticky grants", () => {
  it("does not cache allow-once approval", async () => {
    const pair = await setup(() => "once");
    try {
      expect((await pair.client.callTool(file("feature/test"))).isError).toBeFalsy();
      expect((await pair.client.callTool(file("feature/test"))).isError).toBeFalsy();
      expect(pair.prompts).toHaveLength(2);
      expect(pair.createOrUpdateFile).toHaveBeenCalledTimes(2);
      expect(pair.prompts[0]).not.toContain("do not include in prompt");
    } finally {
      await pair.close();
    }
  });

  it("tool-session grant is limited to tool, project, branch and operation", async () => {
    const pair = await setup(() => "tool_session");
    try {
      await pair.client.callTool(file("feature/a"));
      await pair.client.callTool(file("feature/a", "team/backend", "src/two.ts"));
      expect(pair.prompts).toHaveLength(1);

      await pair.client.callTool(
        push("feature/a", [{ action: "create", file_path: "src/new.ts" }])
      );
      expect(pair.prompts).toHaveLength(2); // different tool

      await pair.client.callTool(file("feature/b"));
      await pair.client.callTool(file("feature/a", "other/project"));
      expect(pair.prompts).toHaveLength(4);
      expect(pair.createOrUpdateFile).toHaveBeenCalledTimes(4);
    } finally {
      await pair.close();
    }
  });

  it("branch-session grant covers only ordinary file creates/updates across both tools", async () => {
    const pair = await setup(() => "resource_session");
    try {
      await pair.client.callTool(file("feature/a"));
      const allowed = await pair.client.callTool(
        push("feature/a", [
          { action: "create", file_path: "src/new.ts" },
          { action: "update", file_path: "tests/new.test.ts" }
        ])
      );
      expect(allowed.isError).toBeFalsy();
      expect(pair.prompts).toHaveLength(1);

      // File creation/update includes CI/config files; destructive and force writes still need approval.
      await pair.client.callTool(
        push("feature/a", [{ action: "delete", file_path: "src/old.ts" }])
      );
      await pair.client.callTool(file("feature/a", "team/backend", ".gitlab-ci.yml"));
      await pair.client.callTool(file("feature/a", "team/backend", ".env"));
      await pair.client.callTool(file("feature/a", "team/backend", "CODEOWNERS"));
      expect(pair.prompts).toHaveLength(2); // first grant + destructive batch only
      await pair.client.callTool(
        push("feature/a", [{ action: "update", file_path: "src/force.ts" }], "team/backend", true)
      );
      await pair.client.callTool(file("main"));
      expect(pair.prompts).toHaveLength(4); // force and different branch need new consent
    } finally {
      await pair.close();
    }
  });

  it("never grants sticky consent for a batch containing delete/move/chmod", async () => {
    const pair = await setup(() => "once");
    try {
      await pair.client.callTool(
        push("feature/a", [
          { action: "update", file_path: "src/keep.ts" },
          { action: "move", file_path: "src/move.ts" }
        ])
      );
      await pair.client.callTool(push("feature/a", [{ action: "chmod", file_path: "src/x" }]));
      await pair.client.callTool(push("feature/a", [{ action: "delete", file_path: "src/x" }]));
      expect(pair.prompts).toHaveLength(3);
      for (const message of pair.prompts) {
        expect(message).not.toContain("resource_session:");
        expect(message).not.toContain("tool_session:");
      }
    } finally {
      await pair.close();
    }
  });

  it("MR-session grant allows add-note equivalents on one MR, not another MR or metadata changes", async () => {
    const pair = await setup(() => "resource_session");
    try {
      await pair.client.callTool({
        name: "gitlab_create_merge_request_note",
        arguments: { project_id: "team/backend", merge_request_iid: "42", body: "first" }
      });
      await pair.client.callTool({
        name: "gitlab_create_note",
        arguments: {
          project_id: "team/backend",
          noteable_type: "merge_request",
          noteable_iid: "42",
          body: "second"
        }
      });
      expect(pair.prompts).toHaveLength(1);

      await pair.client.callTool({
        name: "gitlab_create_merge_request_note",
        arguments: { project_id: "team/backend", merge_request_iid: "43", body: "third" }
      });
      await pair.client.callTool({
        name: "gitlab_update_merge_request",
        arguments: { project_id: "team/backend", merge_request_iid: "42", title: "New title" }
      });
      expect(pair.prompts).toHaveLength(3);
    } finally {
      await pair.close();
    }
  });

  it("MR update grant never covers merge/close/retarget operations", async () => {
    const pair = await setup((message) =>
      message.includes("resource_session:") ? "resource_session" : "once"
    );
    try {
      await pair.client.callTool({
        name: "gitlab_update_merge_request",
        arguments: { project_id: "team/backend", merge_request_iid: "42", description: "doc" }
      });
      await pair.client.callTool({
        name: "gitlab_update_merge_request",
        arguments: { project_id: "team/backend", merge_request_iid: "42", title: "Title" }
      });
      expect(pair.prompts).toHaveLength(1);

      await pair.client.callTool({
        name: "gitlab_update_merge_request",
        arguments: { project_id: "team/backend", merge_request_iid: "42", state_event: "close" }
      });
      await pair.client.callTool({
        name: "gitlab_update_merge_request",
        arguments: { project_id: "team/backend", merge_request_iid: "42", target_branch: "main" }
      });
      expect(pair.prompts).toHaveLength(3);
    } finally {
      await pair.close();
    }
  });

  it("grants expire when the MCP connection closes", async () => {
    const first = await setup(() => "resource_session");
    await first.client.callTool(file("feature/a"));
    await first.close();

    const second = await setup(() => "once");
    try {
      await second.client.callTool(file("feature/a"));
      expect(second.prompts).toHaveLength(1);
    } finally {
      await second.close();
    }
  });

  it("does not cache approval when GitLab operation failed", async () => {
    const pair = await setup(() => "resource_session");
    try {
      pair.createOrUpdateFile.mockRejectedValueOnce(new Error("GitLab rejected the request"));
      expect((await pair.client.callTool(file("feature/a"))).isError).toBe(true);
      expect((await pair.client.callTool(file("feature/a"))).isError).toBeFalsy();
      expect(pair.prompts).toHaveLength(2);
    } finally {
      await pair.close();
    }
  });

  it("project-only sticky grants still require the exact project", async () => {
    const pair = await setup(() => "tool_session");
    const create = (project: string) => ({
      name: "gitlab_create_issue",
      arguments: { project_id: project, title: "Issue" }
    });
    try {
      await pair.client.callTool(create("team/backend"));
      await pair.client.callTool(create("team/backend"));
      await pair.client.callTool(create("other/project"));
      expect(pair.prompts).toHaveLength(2);
      expect(pair.createIssue).toHaveBeenCalledTimes(3);
    } finally {
      await pair.close();
    }
  });
});

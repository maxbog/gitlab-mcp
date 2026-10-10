import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../../src/server/build-server.js";
import { buildContext } from "./_helpers.js";

type ApprovalReply =
  | { action: "accept"; content: { confirm: boolean; approval: string } }
  | { action: "decline" | "cancel" };

async function setup(mode: "ask" | "full", reply?: ApprovalReply, advertiseElicitation = true) {
  const createIssue = vi.fn().mockResolvedValue({ id: 10, iid: 1 });
  const deleteIssue = vi.fn().mockResolvedValue({ success: true });
  const getProject = vi.fn().mockResolvedValue({ id: 12, name: "demo" });
  const context = buildContext({
    permissionMode: mode,
    gitlabStub: {
      createIssue: createIssue as never,
      deleteIssue: deleteIssue as never,
      getProject: getProject as never
    }
  });
  const server = createMcpServer(context);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "approval-test-client", version: "1.0.0" },
    { capabilities: advertiseElicitation ? { elicitation: { form: {} } } : {} }
  );
  const prompts: string[] = [];

  if (advertiseElicitation) {
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      prompts.push(request.params.message);
      if (!reply) {
        throw new Error("Unexpected elicitation request");
      }
      return reply;
    });
  }

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    createIssue,
    deleteIssue,
    getProject,
    prompts,
    async close() {
      await client.close();
      await server.close();
    }
  };
}

const issueCall = {
  name: "gitlab_create_issue",
  arguments: { project_id: "group/demo", title: "Add tests" }
};

describe("MCP write approval (ask mode)", () => {
  it("runs read tools without elicitation", async () => {
    const pair = await setup("ask", undefined, false);
    try {
      const response = await pair.client.callTool({
        name: "gitlab_get_project",
        arguments: { project_id: "group/demo" }
      });
      expect(response.isError).toBeFalsy();
      expect(pair.getProject).toHaveBeenCalledOnce();
      expect(pair.createIssue).not.toHaveBeenCalled();
    } finally {
      await pair.close();
    }
  });

  it("elicits consent for writes and executes only after explicit confirmation", async () => {
    const pair = await setup("ask", {
      action: "accept",
      content: { confirm: true, approval: "Allow this call once" }
    });
    try {
      const response = await pair.client.callTool(issueCall);
      expect(response.isError).toBeFalsy();
      expect(pair.createIssue).toHaveBeenCalledOnce();
      expect(pair.prompts).toHaveLength(1);
      expect(pair.prompts[0]).toContain("gitlab_create_issue");
      expect(pair.prompts[0]).toContain("group/demo");
      expect(pair.prompts[0]).not.toContain("Add tests");
    } finally {
      await pair.close();
    }
  });

  for (const [description, reply] of [
    ["decline", { action: "decline" }],
    ["cancel", { action: "cancel" }],
    [
      "unchecked confirmation",
      { action: "accept", content: { confirm: false, approval: "Allow this call once" } }
    ]
  ] as const) {
    it(`blocks writes on ${description}`, async () => {
      const pair = await setup("ask", reply);
      try {
        const response = await pair.client.callTool(issueCall);
        expect(response.isError).toBe(true);
        expect(pair.createIssue).not.toHaveBeenCalled();
      } finally {
        await pair.close();
      }
    });
  }

  it("fails closed when the client has no elicitation capability", async () => {
    const pair = await setup("ask", undefined, false);
    try {
      const response = await pair.client.callTool(issueCall);
      expect(response.isError).toBe(true);
      expect(pair.createIssue).not.toHaveBeenCalled();
      expect(pair.prompts).toHaveLength(0);
    } finally {
      await pair.close();
    }
  });

  it("requires explicit confirmation for delete-capability tools too", async () => {
    const pair = await setup("ask", { action: "decline" });
    try {
      const result = await pair.client.callTool({
        name: "gitlab_delete_issue",
        arguments: { project_id: "group/demo", issue_iid: "1" }
      });
      expect(result.isError).toBe(true);
      expect(pair.deleteIssue).not.toHaveBeenCalled();
      expect(pair.prompts[0]).toContain("GitLab delete operation");
    } finally {
      await pair.close();
    }
  });

  it("fails closed if the elicitation handler fails", async () => {
    const pair = await setup("ask");
    try {
      const result = await pair.client.callTool(issueCall);
      expect(result.isError).toBe(true);
      expect(pair.createIssue).not.toHaveBeenCalled();
    } finally {
      await pair.close();
    }
  });

  it("keeps full mode behavior unchanged", async () => {
    const pair = await setup("full", undefined, false);
    try {
      const response = await pair.client.callTool(issueCall);
      expect(response.isError).toBeFalsy();
      expect(pair.createIssue).toHaveBeenCalledOnce();
    } finally {
      await pair.close();
    }
  });
});

import { describe, expect, it } from "vitest";

import { ApprovalManager, classifyForStickyApproval } from "../src/lib/elicitation.js";
import type { GitLabToolDefinition } from "../src/tools/gitlab.js";

const write = (name: string) =>
  ({ name, capabilities: ["write"] }) as Pick<GitLabToolDefinition, "name" | "capabilities">;

function fileArgs(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    project_id: "team/backend",
    file_path: "src/app.ts",
    branch: "feature/a",
    content: "x",
    ...overrides
  };
}

describe("sticky approval classification", () => {
  it("distinguishes projects and branches", () => {
    const base = classifyForStickyApproval(write("gitlab_create_or_update_file"), fileArgs());
    const other = classifyForStickyApproval(
      write("gitlab_create_or_update_file"),
      fileArgs({ project_id: "team/other", branch: "feature/b" })
    );
    expect(base).toMatchObject({
      projectId: "team/backend",
      resourceType: "branch",
      resourceId: "feature/a",
      operation: "file.create_update"
    });
    expect(other?.resourceId).toBe("feature/b");
    expect(other?.projectId).toBe("team/other");
  });

  it("rejects ambiguous file paths without imposing a filename-based policy", () => {
    for (const path of [
      "../secret",
      "src/../secret",
      "src/%2e%2e/secret",
      "src//file.ts",
      "/absolute/path",
      "src\\\\file.ts"
    ]) {
      expect(
        classifyForStickyApproval(
          write("gitlab_create_or_update_file"),
          fileArgs({ file_path: path })
        )
      ).toBeUndefined();
    }
    // Consent applies to file create/update operations on a branch, not a guessed
    // list of supposedly "safe" paths. GitLab access policies remain authoritative.
    for (const path of [
      ".gitlab-ci.yml",
      ".gitlab/pipeline.yml",
      ".github/workflows/main.yml",
      ".env",
      ".env.production",
      "CODEOWNERS",
      ".gitmodules",
      "src/app.ts"
    ]) {
      expect(
        classifyForStickyApproval(
          write("gitlab_create_or_update_file"),
          fileArgs({ file_path: path })
        )
      ).toMatchObject({ operation: "file.create_update", resourceId: "feature/a" });
    }
    for (const branch of ["main", "master", "production", "feature/a"]) {
      expect(
        classifyForStickyApproval(write("gitlab_create_or_update_file"), fileArgs({ branch }))
      ).toMatchObject({ resourceId: branch });
    }
  });

  it("disallows force, chmod, move and mixed delete batches", () => {
    const tool = write("gitlab_push_files");
    const base = { project_id: "team/backend", branch: "feature/a" };
    for (const options of [
      { force: true, actions: [{ action: "update", file_path: "src/a.ts" }] },
      { start_branch: "main", actions: [{ action: "update", file_path: "src/a.ts" }] },
      { actions: [{ action: "delete", file_path: "src/a.ts" }] },
      { actions: [{ action: "move", file_path: "src/a.ts" }] },
      { actions: [{ action: "chmod", file_path: "src/a.ts" }] },
      {
        actions: [
          { action: "update", file_path: "src/a.ts" },
          { action: "delete", file_path: "src/b.ts" }
        ]
      }
    ]) {
      expect(classifyForStickyApproval(tool, { ...base, ...options })).toBeUndefined();
    }
    expect(
      classifyForStickyApproval(tool, {
        ...base,
        actions: [
          { action: "create", file_path: "src/a.ts" },
          { action: "update", file_path: "src/b.ts" }
        ]
      })
    ).toMatchObject({ operation: "file.create_update", resourceId: "feature/a" });
  });

  it("never caches admin, delete, GraphQL or unknown operations", () => {
    for (const capability of ["admin", "delete", "graphql"] as const) {
      expect(
        classifyForStickyApproval(
          { name: "gitlab_create_or_update_file", capabilities: ["write", capability] },
          fileArgs()
        )
      ).toBeUndefined();
    }
    expect(
      classifyForStickyApproval(write("gitlab_merge_merge_request"), {
        project_id: "team/backend",
        merge_request_iid: "42"
      })
    ).toBeUndefined();
  });

  it("distinguishes MR notes, edits and state transitions", () => {
    const args = { project_id: "team/backend", merge_request_iid: "42" };
    expect(
      classifyForStickyApproval(write("gitlab_create_merge_request_note"), {
        ...args,
        body: "hello"
      })?.operation
    ).toBe("mr.note.add");
    expect(
      classifyForStickyApproval(write("gitlab_create_note"), {
        project_id: "team/backend",
        noteable_iid: "42",
        noteable_type: "merge_request",
        body: "hi"
      })?.operation
    ).toBe("mr.note.add");
    expect(
      classifyForStickyApproval(write("gitlab_create_note"), {
        project_id: "team/backend",
        noteable_iid: "42",
        noteable_type: "issue",
        body: "hi"
      })
    ).toBeUndefined();
    expect(
      classifyForStickyApproval(write("gitlab_update_merge_request"), {
        ...args,
        description: "ok"
      })?.operation
    ).toBe("mr.metadata.edit");
    for (const option of [{ state_event: "close" }, { target_branch: "main" }, { squash: true }]) {
      expect(
        classifyForStickyApproval(write("gitlab_update_merge_request"), {
          ...args,
          description: "ok",
          ...option
        })
      ).toBeUndefined();
    }
  });

  it("only trusts an omitted project when precisely one project is allowlisted", () => {
    const args = fileArgs({ project_id: undefined });
    expect(classifyForStickyApproval(write("gitlab_create_or_update_file"), args)).toBeUndefined();
    expect(
      classifyForStickyApproval(write("gitlab_create_or_update_file"), args, ["team/backend"])
    ).toMatchObject({ projectId: "team/backend" });
    expect(
      classifyForStickyApproval(write("gitlab_create_or_update_file"), args, ["team/a", "team/b"])
    ).toBeUndefined();
  });
});

describe("approval grant lifetime", () => {
  it("does not expire session grants by time and can be explicitly cleared", () => {
    const approvals = new ApprovalManager();
    const intent = classifyForStickyApproval(write("gitlab_create_or_update_file"), fileArgs());
    expect(intent).toBeDefined();

    const grant = {
      choice: "resource_session" as const,
      toolName: "gitlab_create_or_update_file",
      intent: intent!
    };
    approvals.remember(grant);
    expect(approvals.listGrants()).toHaveLength(1);
    // No TTL or clock-driven expiration: the hosting MCP connection owns lifecycle.
    approvals.remember(grant);
    expect(approvals.listGrants()).toHaveLength(1);

    const snapshot = approvals.listGrants();
    expect(snapshot[0]).toEqual(grant);
    // Snapshot mutations must not modify internal grants.
    snapshot[0]!.intent.resourceId = "other";
    expect(approvals.listGrants()[0]?.intent.resourceId).toBe("feature/a");

    approvals.clear();
    expect(approvals.listGrants()).toHaveLength(0);
  });
});

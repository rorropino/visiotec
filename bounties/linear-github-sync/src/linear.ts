import { config } from "./config.js";
import type { CanonicalIssue } from "./types.js";

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.linearApiKey(),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok || json.errors?.length) {
    throw new Error(json.errors?.map((e) => e.message).join("; ") || `Linear HTTP ${response.status}`);
  }
  if (!json.data) throw new Error("Linear returned no data");
  return json.data;
}

export async function getLinearIssue(id: string) {
  const data = await gql<{ issue: any }>(
    `query($id:String!){ issue(id:$id){ id identifier title description updatedAt state{ type } } }`,
    { id },
  );
  return data.issue;
}

export async function createLinearIssue(issue: CanonicalIssue) {
  const data = await gql<{ issueCreate: { issue: any } }>(
    `mutation($input:IssueCreateInput!){ issueCreate(input:$input){ issue{ id identifier title description updatedAt state{ type } } } }`,
    {
      input: {
        teamId: config.linearTeamId(),
        title: issue.title,
        description: issue.body,
      },
    },
  );
  return data.issueCreate.issue;
}

export async function updateLinearIssue(id: string, issue: CanonicalIssue) {
  const data = await gql<{ issueUpdate: { issue: any } }>(
    `mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ issue{ id identifier title description updatedAt state{ type } } } }`,
    {
      id,
      input: {
        title: issue.title,
        description: issue.body,
      },
    },
  );
  return data.issueUpdate.issue;
}

export async function listLinearIssues() {
  const data = await gql<{ team: { issues: { nodes: any[] } } }>(
    `query($id:String!){ team(id:$id){ issues(first:100){ nodes{ id identifier title description updatedAt state{ type } } } } }`,
    { id: config.linearTeamId() },
  );
  return data.team.issues.nodes;
}

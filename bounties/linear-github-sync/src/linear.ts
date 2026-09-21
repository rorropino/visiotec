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

const fields = "id identifier title description updatedAt state{ id type }";

export async function getLinearIssue(id: string) {
  const data = await gql<{ issue: any }>(
    `query($id:String!){ issue(id:$id){ ${fields} } }`,
    { id },
  );
  return data.issue;
}

async function targetStateId(closed: boolean): Promise<string | undefined> {
  const data = await gql<{ team: { states: { nodes: Array<{ id: string; type: string }> } } }>(
    `query($id:String!){ team(id:$id){ states{ nodes{ id type } } } }`,
    { id: config.linearTeamId() },
  );
  const wanted = closed ? ["completed", "canceled"] : ["started", "unstarted", "backlog"];
  return data.team.states.nodes.find((state) => wanted.includes(state.type))?.id;
}

export async function createLinearIssue(issue: CanonicalIssue) {
  const stateId = await targetStateId(issue.state === "closed");
  const data = await gql<{ issueCreate: { issue: any } }>(
    `mutation($input:IssueCreateInput!){ issueCreate(input:$input){ issue{ ${fields} } } }`,
    {
      input: {
        teamId: config.linearTeamId(),
        title: issue.title,
        description: issue.body,
        ...(stateId ? { stateId } : {}),
      },
    },
  );
  return data.issueCreate.issue;
}

export async function updateLinearIssue(id: string, issue: CanonicalIssue) {
  const stateId = await targetStateId(issue.state === "closed");
  const data = await gql<{ issueUpdate: { issue: any } }>(
    `mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ issue{ ${fields} } } }`,
    {
      id,
      input: {
        title: issue.title,
        description: issue.body,
        ...(stateId ? { stateId } : {}),
      },
    },
  );
  return data.issueUpdate.issue;
}

export async function listLinearIssues() {
  const data = await gql<{ team: { issues: { nodes: any[] } } }>(
    `query($id:String!){ team(id:$id){ issues(first:100){ nodes{ ${fields} } } } }`,
    { id: config.linearTeamId() },
  );
  return data.team.issues.nodes;
}

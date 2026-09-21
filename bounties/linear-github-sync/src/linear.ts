import { config } from "./config.js";
import type { CanonicalIssue, LinearIssue } from "./types.js";

const ENDPOINT = "https://api.linear.app/graphql";

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: config.linearApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await res.json();
  if (!res.ok || payload.errors) {
    throw new Error(`Linear error: ${JSON.stringify(payload.errors ?? payload)}`);
  }
  return payload.data as T;
}

const ISSUE_FIELDS = `
  id identifier title description updatedAt
  team { id key }
  state { id name type }
`;

export async function getLinearIssue(id: string): Promise<LinearIssue> {
  const data = await gql<{ issue: LinearIssue }>(
    `query($id:String!){ issue(id:$id){ ${ISSUE_FIELDS} } }`,
    { id },
  );
  return data.issue;
}

async function stateIdFor(teamId: string, closed: boolean): Promise<string> {
  const data = await gql<{ team: { states: { nodes: Array<{ id: string; type: string }> } } }>(
    `query($id:String!){ team(id:$id){ states{ nodes{ id type } } } }`,
    { id: teamId },
  );
  const preferred = closed
    ? ["completed", "canceled"]
    : ["started", "unstarted", "backlog"];
  for (const type of preferred) {
    const found = data.team.states.nodes.find((s) => s.type === type);
    if (found) return found.id;
  }
  throw new Error(`No suitable Linear workflow state for team ${teamId}`);
}

export async function createLinearIssue(
  teamId: string,
  issue: CanonicalIssue,
): Promise<LinearIssue> {
  const stateId = await stateIdFor(teamId, issue.closed);
  const data = await gql<{ issueCreate: { success: boolean; issue: LinearIssue } }>(
    `mutation($input:IssueCreateInput!){
      issueCreate(input:$input){ success issue{ ${ISSUE_FIELDS} } }
    }`,
    { input: { teamId, title: issue.title, description: issue.body, stateId } },
  );
  if (!data.issueCreate.success) throw new Error("Linear issueCreate failed");
  return data.issueCreate.issue;
}

export async function updateLinearIssue(
  issueId: string,
  teamId: string,
  issue: CanonicalIssue,
): Promise<LinearIssue> {
  const stateId = await stateIdFor(teamId, issue.closed);
  const data = await gql<{ issueUpdate: { success: boolean; issue: LinearIssue } }>(
    `mutation($id:String!,$input:IssueUpdateInput!){
      issueUpdate(id:$id,input:$input){ success issue{ ${ISSUE_FIELDS} } }
    }`,
    { id: issueId, input: { title: issue.title, description: issue.body, stateId } },
  );
  if (!data.issueUpdate.success) throw new Error("Linear issueUpdate failed");
  return data.issueUpdate.issue;
}

export async function listLinearIssues(teamId: string): Promise<LinearIssue[]> {
  const data = await gql<{ team: { issues: { nodes: LinearIssue[] } } }>(
    `query($id:String!){
      team(id:$id){ issues(first:100,orderBy:updatedAt){ nodes{ ${ISSUE_FIELDS} } } }
    }`,
    { id: teamId },
  );
  return data.team.issues.nodes;
}

import { Octokit } from "@octokit/rest";
import { config } from "./config.js";
import type { CanonicalIssue } from "./types.js";

function client() {
  return new Octokit({ auth: config.githubToken() });
}

export async function getGithubIssue(number: number) {
  const gh = client();
  const { data } = await gh.issues.get({
    owner: config.githubOwner(),
    repo: config.githubRepo(),
    issue_number: number,
  });
  return data;
}

export async function createGithubIssue(issue: CanonicalIssue) {
  const gh = client();
  const { data } = await gh.issues.create({
    owner: config.githubOwner(),
    repo: config.githubRepo(),
    title: issue.title,
    body: issue.body,
  });
  return data;
}

export async function updateGithubIssue(number: number, issue: CanonicalIssue) {
  const gh = client();
  const { data } = await gh.issues.update({
    owner: config.githubOwner(),
    repo: config.githubRepo(),
    issue_number: number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
  });
  return data;
}

export async function listGithubIssues() {
  const gh = client();
  const { data } = await gh.issues.listForRepo({
    owner: config.githubOwner(),
    repo: config.githubRepo(),
    state: "all",
    per_page: 100,
  });
  return data.filter((x) => !("pull_request" in x));
}

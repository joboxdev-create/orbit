import type { Capability, ConnectorDefinition } from "@orbit/connector-sdk";
import { z } from "zod";
import {
  ghGet,
  type GithubConfig,
  type GithubCredentials,
} from "./client.js";

const configSchema = z.object({
  baseUrl: z.string().url().default("https://api.github.com"),
});

const credentialsSchema = z.object({
  token: z.string().min(1).optional(),
});

// --- raw API shapes (only the fields we surface) ---
interface GhRepo {
  full_name: string;
  name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  open_issues_count: number;
}

interface GhIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: { login: string } | null;
}

const mapRepo = (r: GhRepo) => ({
  fullName: r.full_name,
  name: r.name,
  private: r.private,
  url: r.html_url,
  description: r.description,
  stars: r.stargazers_count,
  openIssues: r.open_issues_count,
});

const listOrgRepos: Capability = {
  name: "list_org_repos",
  title: "List organization repositories",
  description: "List repositories belonging to a GitHub organization.",
  topic: "repos",
  readOnly: true,
  input: z.object({
    org: z.string().min(1),
    perPage: z.number().int().min(1).max(100).default(30),
  }),
  handler: async (ctx, input) => {
    const { org, perPage } = input as { org: string; perPage: number };
    const repos = await ghGet<GhRepo[]>(
      ctx,
      `/orgs/${encodeURIComponent(org)}/repos?per_page=${perPage}`,
    );
    return repos.map(mapRepo);
  },
};

const getRepo: Capability = {
  name: "get_repo",
  title: "Get a repository",
  description: "Fetch a single repository by owner and name.",
  topic: "repos",
  readOnly: true,
  input: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
  }),
  handler: async (ctx, input) => {
    const { owner, repo } = input as { owner: string; repo: string };
    const r = await ghGet<GhRepo>(
      ctx,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    );
    return mapRepo(r);
  },
};

const listRepoIssues: Capability = {
  name: "list_repo_issues",
  title: "List repository issues",
  description: "List issues for a repository (most recent first).",
  topic: "issues",
  readOnly: true,
  input: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    state: z.enum(["open", "closed", "all"]).default("open"),
    perPage: z.number().int().min(1).max(100).default(30),
  }),
  handler: async (ctx, input) => {
    const { owner, repo, state, perPage } = input as {
      owner: string;
      repo: string;
      state: string;
      perPage: number;
    };
    const issues = await ghGet<GhIssue[]>(
      ctx,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/issues?state=${state}&per_page=${perPage}`,
    );
    return issues.map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      url: i.html_url,
      author: i.user?.login ?? null,
    }));
  },
};

export const githubConnector: ConnectorDefinition<
  GithubConfig,
  GithubCredentials
> = {
  type: "github",
  layer: "repository",
  displayName: "GitHub",
  description: "Repositories, issues and pull requests on GitHub.",
  configSchema,
  credentialsSchema,
  capabilities: [listOrgRepos, getRepo, listRepoIssues],
  api: {
    baseUrl: "https://api.github.com",
    operations: [
      {
        id: "repos.listForOrg",
        topic: "repos",
        method: "GET",
        path: "/orgs/{org}/repos",
        summary: "List organization repositories",
        docsUrl:
          "https://docs.github.com/rest/repos/repos#list-organization-repositories",
      },
      {
        id: "repos.get",
        topic: "repos",
        method: "GET",
        path: "/repos/{owner}/{repo}",
        summary: "Get a repository",
        docsUrl: "https://docs.github.com/rest/repos/repos#get-a-repository",
      },
      {
        id: "issues.listForRepo",
        topic: "issues",
        method: "GET",
        path: "/repos/{owner}/{repo}/issues",
        summary: "List repository issues",
        docsUrl:
          "https://docs.github.com/rest/issues/issues#list-repository-issues",
      },
    ],
  },
  testConnection: async (ctx) => {
    // /rate_limit works with or without a token; cheap reachability + auth check.
    await ghGet(ctx, "/rate_limit");
  },
};

export default githubConnector;

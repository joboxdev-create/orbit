import type { Capability, ConnectorDefinition } from "@orbit/connector-sdk";
import { z } from "zod";
import {
  ghGet,
  ghPost,
  ghRawRequest,
  type GithubConfig,
  type GithubCredentials,
} from "./client.js";
import { githubOperations } from "./generated/operations.js";

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

const createRepo: Capability = {
  name: "create_repo",
  title: "Create a repository",
  description:
    "Create a new repository for the authenticated user (requires a token with repo scope).",
  topic: "repos",
  readOnly: false,
  input: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    private: z.boolean().default(false),
    autoInit: z.boolean().default(false),
  }),
  handler: async (ctx, input) => {
    const { name, description, private: priv, autoInit } = input as {
      name: string;
      description?: string;
      private: boolean;
      autoInit: boolean;
    };
    const r = await ghPost<GhRepo>(ctx, "/user/repos", {
      name,
      description,
      private: priv,
      auto_init: autoInit,
    });
    return mapRepo(r);
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
  icon: "github",
  configSchema,
  credentialsSchema,
  capabilities: [listOrgRepos, getRepo, listRepoIssues, createRepo],
  api: {
    baseUrl: "https://api.github.com",
    // Full REST surface (~1200 ops) generated from GitHub's official OpenAPI
    // description — see scripts/gen-operations.mjs.
    operations: githubOperations,
    // Tier-2 generic invoker: lets the host call ANY operation above (or a raw
    // method+path) reusing the connected token, without a hand-written handler.
    request: ghRawRequest,
  },
  // GitHub publishes an official remote MCP server (Streamable HTTP), auth via
  // an Authorization: Bearer <PAT> header. Suggested one-click in the MCP tab.
  officialMcp: {
    transport: "http",
    url: "https://api.githubcopilot.com/mcp/",
    secretKeys: ["Authorization"],
    description:
      "GitHub's official remote MCP server. Auth header value: \"Bearer <your PAT>\".",
    docsUrl: "https://github.com/github/github-mcp-server",
  },
  testConnection: async (ctx) => {
    // With a token, validate it (GET /user → 401 if invalid); without one, just
    // check reachability with the public /rate_limit endpoint.
    const { token } = ctx.credentials as GithubCredentials;
    await ghGet(ctx, token ? "/user" : "/rate_limit");
  },
};

export default githubConnector;

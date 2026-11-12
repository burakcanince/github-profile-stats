import { GITHUB_API, USER_AGENT } from "./constants.js";
import { sinceDate } from "./dates.js";
import type { GitHubRepo, GitHubRepoDetails, GitHubUser } from "./types.js";

export type Request = <T>(path: string) => Promise<{ data: T; headers: Headers }>;

function httpError(message: string, status: number): Error {
  return new Error(message, { cause: status });
}

function hasStatus(err: unknown, status: number): boolean {
  return err instanceof Error && err.cause === status;
}

export function createClient(token: string | undefined): Request {
  return async function request<T>(path: string) {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${GITHUB_API}${path}`, { headers });

    const isRateLimited =
      response.status === 429 ||
      (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
    if (isRateLimited) {
      throw httpError(
        "GitHub API rate limit exceeded. Pass a token with --token or set GITHUB_TOKEN.",
        response.status
      );
    }
    if (response.status === 401) {
      throw httpError("The GitHub token is invalid.", response.status);
    }
    if (!response.ok) {
      throw httpError(`GitHub API error: ${response.status} ${response.statusText}`, response.status);
    }

    return { data: (await response.json()) as T, headers: response.headers };
  };
}

function lastPageFromLink(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? Number(match[1]) : null;
}

async function countItems(request: Request, path: string): Promise<number> {
  const { data, headers } = await request<unknown[]>(path);
  return lastPageFromLink(headers.get("link")) ?? data.length;
}

export async function fetchUser(request: Request, username: string): Promise<GitHubUser> {
  try {
    const { data } = await request<GitHubUser>(`/users/${encodeURIComponent(username)}`);
    return data;
  } catch (err) {
    if (hasStatus(err, 404)) throw httpError(`User "${username}" not found.`, 404);
    throw err;
  }
}

export async function fetchRepos(request: Request, username: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  for (let page = 1; ; page++) {
    const { data } = await request<GitHubRepo[]>(
      `/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&type=owner`
    );
    repos.push(...data);
    if (data.length < 100) break;
  }
  return repos;
}

export async function fetchCommitCount(request: Request, username: string, days: number): Promise<number> {
  const query = encodeURIComponent(`author:${username} author-date:>=${sinceDate(days).slice(0, 10)}`);
  const { data } = await request<{ total_count: number }>(`/search/commits?q=${query}&per_page=1`);
  return data.total_count;
}

export function fetchStarredCount(request: Request, username: string): Promise<number> {
  return countItems(request, `/users/${encodeURIComponent(username)}/starred?per_page=1`);
}

function parseRepoName(fullName: string): [owner: string, name: string] {
  const [owner, name, ...rest] = fullName.split("/");
  if (!owner || !name || rest.length > 0) {
    throw new Error(`Invalid repository "${fullName}". Use the owner/name format.`);
  }
  return [owner, name];
}

export async function fetchRepo(
  request: Request,
  fullName: string,
  days: number
): Promise<{ repo: GitHubRepoDetails; commits: number }> {
  const repoPath = `/repos/${parseRepoName(fullName).map(encodeURIComponent).join("/")}`;

  let repo: GitHubRepoDetails;
  try {
    ({ data: repo } = await request<GitHubRepoDetails>(repoPath));
  } catch (err) {
    if (hasStatus(err, 404)) throw httpError(`Repository "${fullName}" not found.`, 404);
    throw err;
  }

  let commits: number;
  try {
    commits = await countItems(request, `${repoPath}/commits?since=${sinceDate(days)}&per_page=1`);
  } catch (err) {
    if (!hasStatus(err, 409)) throw err;
    commits = 0;
  }

  return { repo, commits };
}

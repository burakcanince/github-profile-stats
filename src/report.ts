import { DEFAULT_TOP } from "./constants.js";
import { fetchContributionDays, selectRange, summarizeContributions } from "./contributions.js";
import { formatDays, rangeLabel } from "./dates.js";
import {
  fetchCommitCount,
  fetchRepo,
  fetchRepos,
  fetchStarredCount,
  fetchUser,
  type Request,
} from "./github.js";
import { calculateDevScore, summarizeRepos } from "./stats.js";
import type { Options, Report, Row, UserStats } from "./types.js";

export async function getUserStats(request: Request, username: string, options: Options): Promise<UserStats> {
  const user = await fetchUser(request, username);

  const [repos, commits, starred, allDays] = await Promise.all([
    fetchRepos(request, user.login),
    fetchCommitCount(request, user.login, options.days),
    fetchStarredCount(request, user.login),
    fetchContributionDays(user.login),
  ]);

  const rangeDays = allDays ? selectRange(allDays, options.year) : null;
  const contributions = allDays && summarizeContributions(rangeDays ?? [], allDays);
  const repoSummary = summarizeRepos(repos);

  return {
    user,
    commits,
    starred,
    rangeDays,
    contributions,
    repoSummary,
    devScore: calculateDevScore(user, repoSummary, contributions),
  };
}

export function buildUserReport(stats: UserStats, options: Options): Report {
  const { user, commits, starred, contributions, repoSummary, devScore } = stats;

  const rows: Row[] = [
    ["Public repos", user.public_repos],
    ["Followers", user.followers],
    ["Following", user.following],
    ["Total stars", repoSummary.totalStars],
    ["Total forks", repoSummary.totalForks],
    ["Top language", repoSummary.topLanguage ?? "-"],
    [`Commits in the last ${options.days} days`, commits],
    ["Starred repos", starred],
  ];

  if (contributions) {
    const best = contributions.bestDay;
    rows.push(
      [`Contributions ${rangeLabel(options.year)}`, contributions.total],
      ["Active days", `${contributions.activeDays} / ${contributions.totalDays}`],
      ["Longest streak", formatDays(contributions.longestStreak)],
      ["Current streak", formatDays(contributions.currentStreak)],
      ["Best day", best ? `${best.count} on ${best.date}` : "-"]
    );
  }

  rows.push(["Dev score", `${devScore.overall} (${devScore.tier})`]);

  const data: Record<string, unknown> = {
    user: user.login,
    name: user.name,
    publicRepos: user.public_repos,
    followers: user.followers,
    following: user.following,
    totalStars: repoSummary.totalStars,
    totalForks: repoSummary.totalForks,
    topLanguage: repoSummary.topLanguage,
    commits,
    days: options.days,
    starredRepos: starred,
    contributions: contributions && { range: options.year ?? "last-year", ...contributions },
    languages: repoSummary.languages,
    topRepos: repoSummary.topRepos.slice(0, options.top || DEFAULT_TOP),
    devScore,
  };
  if (options.calendar && stats.rangeDays) data.calendar = stats.rangeDays;

  return { title: `GitHub Profile Report: ${user.login}`, rows, data };
}

export async function getRepoReport(request: Request, fullName: string, days: number): Promise<Report> {
  const { repo, commits } = await fetchRepo(request, fullName, days);
  const license = repo.license?.spdx_id ?? null;
  const createdAt = repo.created_at.slice(0, 10);
  const pushedAt = repo.pushed_at?.slice(0, 10) ?? null;

  return {
    title: `GitHub Repository Report: ${repo.full_name}`,
    data: {
      repo: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      watchers: repo.subscribers_count,
      openIssues: repo.open_issues_count,
      language: repo.language,
      license,
      createdAt,
      pushedAt,
      commits,
      days,
    },
    rows: [
      ["Description", repo.description ?? "-"],
      ["Stars", repo.stargazers_count],
      ["Forks", repo.forks_count],
      ["Watchers", repo.subscribers_count],
      ["Open issues", repo.open_issues_count],
      ["Language", repo.language ?? "-"],
      ["License", license ?? "-"],
      ["Created", createdAt],
      ["Last push", pushedAt ?? "-"],
      [`Commits in the last ${days} days`, commits],
    ],
  };
}

export type CompareRow = [label: string, first: number | null, second: number | null];

export function buildCompareRows(first: UserStats, second: UserStats, options: Options): CompareRow[] {
  const compareRow = (label: string, getValue: (stats: UserStats) => number | null): CompareRow => [
    label,
    getValue(first),
    getValue(second),
  ];
  const contributionValue =
    (key: "total" | "activeDays" | "longestStreak" | "currentStreak") => (stats: UserStats) =>
      stats.contributions ? stats.contributions[key] : null;

  return [
    compareRow("Public repos", (stats) => stats.user.public_repos),
    compareRow("Followers", (stats) => stats.user.followers),
    compareRow("Following", (stats) => stats.user.following),
    compareRow("Total stars", (stats) => stats.repoSummary.totalStars),
    compareRow("Total forks", (stats) => stats.repoSummary.totalForks),
    compareRow(`Commits in the last ${options.days} days`, (stats) => stats.commits),
    compareRow(`Contributions ${rangeLabel(options.year)}`, contributionValue("total")),
    compareRow("Active days", contributionValue("activeDays")),
    compareRow("Longest streak", contributionValue("longestStreak")),
    compareRow("Current streak", contributionValue("currentStreak")),
    compareRow("Dev score", (stats) => stats.devScore.overall),
  ];
}

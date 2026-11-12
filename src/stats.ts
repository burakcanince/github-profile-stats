import { MAX_LANGUAGES } from "./constants.js";
import type {
  ContributionSummary,
  DevScore,
  GitHubRepo,
  GitHubUser,
  LanguageShare,
  RepoSummary,
} from "./types.js";

const SCORE_CEILINGS = {
  activity: 5000,
  stars: 500000,
  forks: 200000,
  followers: 300000,
  repos: 1000,
  streak: 365,
};

const SCORE_WEIGHTS: Record<keyof typeof SCORE_CEILINGS, number> = {
  activity: 0.25,
  stars: 0.2,
  forks: 0.15,
  followers: 0.15,
  repos: 0.1,
  streak: 0.15,
};

const TIERS: [minimum: number, tier: string][] = [
  [90, "Legend"],
  [80, "Elite"],
  [70, "Pro"],
  [55, "Rising"],
  [0, "Rookie"],
];

function percentage(part: number, whole: number): number {
  return Number(((part / whole) * 100).toFixed(1));
}

export function summarizeRepos(repos: GitHubRepo[]): RepoSummary {
  const ownRepos = repos.filter((repo) => !repo.fork);
  const reposPerLanguage = new Map<string, number>();
  for (const repo of ownRepos) {
    if (repo.language) {
      reposPerLanguage.set(repo.language, (reposPerLanguage.get(repo.language) ?? 0) + 1);
    }
  }
  const languagesByRepoCount = Array.from(reposPerLanguage).sort((first, second) => second[1] - first[1]);
  const reposWithLanguage = languagesByRepoCount.reduce((sum, [, count]) => sum + count, 0);

  const languages: LanguageShare[] = languagesByRepoCount.slice(0, MAX_LANGUAGES).map(([name, count]) => ({
    name,
    repos: count,
    percentage: percentage(count, reposWithLanguage),
  }));
  const otherCount = languagesByRepoCount.slice(MAX_LANGUAGES).reduce((sum, [, count]) => sum + count, 0);
  if (otherCount > 0) {
    languages.push({ name: "Other", repos: otherCount, percentage: percentage(otherCount, reposWithLanguage) });
  }

  const topRepos = [...ownRepos]
    .sort(
      (first, second) =>
        second.stargazers_count - first.stargazers_count || second.forks_count - first.forks_count
    )
    .map((repo) => ({
      name: repo.name,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
    }));

  return {
    ownRepos: ownRepos.length,
    totalStars: ownRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
    totalForks: ownRepos.reduce((sum, repo) => sum + repo.forks_count, 0),
    topLanguage: languagesByRepoCount[0]?.[0] ?? null,
    languages,
    topRepos,
  };
}

function clampScore(score: number): number {
  return Math.round(Math.min(99, Math.max(1, score)));
}

function logScore(value: number, ceiling: number): number {
  return clampScore((Math.log10(value + 1) / Math.log10(ceiling + 1)) * 99);
}

export function calculateDevScore(
  user: GitHubUser,
  repoSummary: RepoSummary,
  contributions: ContributionSummary | null
): DevScore {
  const values: Record<keyof typeof SCORE_CEILINGS, number> = {
    activity: contributions?.total ?? 0,
    stars: repoSummary.totalStars,
    forks: repoSummary.totalForks,
    followers: user.followers,
    repos: repoSummary.ownRepos,
    streak: contributions?.longestStreak ?? 0,
  };

  const attributes: Record<string, number> = {};
  let weighted = 0;
  for (const key of Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]) {
    attributes[key] = logScore(values[key], SCORE_CEILINGS[key]);
    weighted += attributes[key] * SCORE_WEIGHTS[key];
  }

  const overall = clampScore(weighted);
  const tier = TIERS.find(([minimum]) => overall >= minimum)?.[1] ?? "Rookie";
  return { overall, tier, attributes };
}

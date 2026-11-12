import type { ThemeName } from "./constants.js";

export interface Options {
  user: string | undefined;
  repo: string | undefined;
  compare: string | undefined;
  calendar: boolean;
  weekday: boolean;
  monthly: boolean;
  languages: boolean;
  top: number;
  year: number | null;
  theme: ThemeName;
  days: number;
  token: string | undefined;
  json: boolean;
  ansi: boolean;
  help: boolean;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitHubRepo {
  name: string;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

export interface GitHubRepoDetails {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  subscribers_count: number;
  open_issues_count: number;
  language: string | null;
  license: { spdx_id: string } | null;
  created_at: string;
  pushed_at: string | null;
}

export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export interface ContributionDay {
  date: string;
  count: number;
  level: ContributionLevel;
}

export interface ContributionSummary {
  total: number;
  activeDays: number;
  totalDays: number;
  longestStreak: number;
  currentStreak: number;
  bestDay: { date: string; count: number } | null;
  weekdays: Record<string, number>;
  months: { month: string; count: number }[];
}

export interface LanguageShare {
  name: string;
  repos: number;
  percentage: number;
}

export interface TopRepo {
  name: string;
  stars: number;
  forks: number;
  language: string | null;
}

export interface RepoSummary {
  ownRepos: number;
  totalStars: number;
  totalForks: number;
  topLanguage: string | null;
  languages: LanguageShare[];
  topRepos: TopRepo[];
}

export interface DevScore {
  overall: number;
  tier: string;
  attributes: Record<string, number>;
}

export interface UserStats {
  user: GitHubUser;
  commits: number;
  starred: number;
  rangeDays: ContributionDay[] | null;
  contributions: ContributionSummary | null;
  repoSummary: RepoSummary;
  devScore: DevScore;
}

export type Row = [label: string, value: string | number];

export interface Report {
  title: string;
  rows: Row[];
  data: Record<string, unknown>;
}

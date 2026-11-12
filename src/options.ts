import { parseArgs } from "node:util";
import { DEFAULT_DAYS, DEFAULT_TOP, THEME_NAMES, THEMES, type ThemeName } from "./constants.js";
import type { Options } from "./types.js";

export const HELP = `Usage: github-profile-stats [username] [options]

Options:
  -u, --user <user>         The GitHub user to get stats about.
  -r, --repo <owner/name>   The full repository name to get stats about.
  -c, --calendar            Show the contribution calendar.
  -w, --weekday             Show contributions by weekday.
  -m, --monthly             Show contributions by month.
  -l, --languages           Show the language breakdown.
      --top <number>        Show the most starred repositories (default: ${DEFAULT_TOP} with --all).
  -a, --all                 Show every section.
  -y, --year <year>         Use contributions from a specific year instead of the last 12 months.
      --theme <name>        Color of the calendar and charts. Use it with -c, -w, -m, -l or -a.
                            Themes: green (default), ${THEME_NAMES.filter((name) => name !== "green").join(", ")}.
      --compare <user>      Compare the user with another GitHub user.
  -d, --days <number>       Number of days to count commits for (default: ${DEFAULT_DAYS}).
  -t, --token <token>       GitHub access token to increase the rate limit.
  -j, --json                Print the report as JSON.
  -n, --no-ansi             Disable ANSI styles.
  -h, --help                Display this help.

Examples:
  npx github-profile-stats <username>
  npx github-profile-stats <username> --calendar --weekday
  npx github-profile-stats <username> --calendar --theme orange
  npx github-profile-stats <username> --all --theme blue
  npx github-profile-stats <username> -c -y 2025
  npx github-profile-stats <username> --compare <other-username>
  npx github-profile-stats -r <owner>/<repo>
  npx github-profile-stats <username> --json

The token can also be set with the GITHUB_TOKEN environment variable.`;

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive whole number.`);
  }
  return parsed;
}

function parseYear(value: string | undefined): number | null {
  if (value === undefined) return null;
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2008 || year > currentYear) {
    throw new Error(`--year must be between 2008 and ${currentYear}.`);
  }
  return year;
}

function parseTheme(value: string | undefined): ThemeName {
  const theme = value ?? "green";
  if (!Object.hasOwn(THEMES, theme)) {
    throw new Error(`Unknown theme "${theme}". Use one of: ${THEME_NAMES.join(", ")}.`);
  }
  return theme as ThemeName;
}

export function parseOptions(argv: string[], env: NodeJS.ProcessEnv, isTTY: boolean): Options {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      user: { type: "string", short: "u" },
      repo: { type: "string", short: "r" },
      calendar: { type: "boolean", short: "c" },
      weekday: { type: "boolean", short: "w" },
      monthly: { type: "boolean", short: "m" },
      languages: { type: "boolean", short: "l" },
      top: { type: "string" },
      all: { type: "boolean", short: "a" },
      year: { type: "string", short: "y" },
      theme: { type: "string" },
      compare: { type: "string" },
      days: { type: "string", short: "d" },
      token: { type: "string", short: "t" },
      json: { type: "boolean", short: "j" },
      "no-ansi": { type: "boolean", short: "n" },
      help: { type: "boolean", short: "h" },
    },
  });

  const all = Boolean(values.all);
  const days = values.days === undefined ? DEFAULT_DAYS : positiveInteger(values.days, "--days");
  let top = values.top === undefined ? 0 : positiveInteger(values.top, "--top");
  if (all && !top) top = DEFAULT_TOP;

  const user = values.user ?? positionals[0];
  if (values.compare && !user) {
    throw new Error(
      "--compare needs a user. Example: github-profile-stats <username> --compare <other-username>"
    );
  }

  return {
    user,
    repo: values.repo,
    compare: values.compare,
    calendar: all || Boolean(values.calendar),
    weekday: all || Boolean(values.weekday),
    monthly: all || Boolean(values.monthly),
    languages: all || Boolean(values.languages),
    top,
    year: parseYear(values.year),
    theme: parseTheme(values.theme),
    days,
    token: values.token ?? env.GITHUB_TOKEN ?? env.GH_TOKEN,
    json: Boolean(values.json),
    ansi: !values["no-ansi"] && !env.NO_COLOR && isTTY,
    help: Boolean(values.help),
  };
}

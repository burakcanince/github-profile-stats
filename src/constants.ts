export const DEFAULT_DAYS = 90;
export const DEFAULT_TOP = 5;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_LANGUAGES = 6;
export const BAR_WIDTH = 30;

export const GITHUB_API = "https://api.github.com";
export const CONTRIBUTIONS_API = "https://github-contributions-api.jogruber.de/v4";
export const USER_AGENT = "github-profile-stats-cli";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const THEMES = {
  green: [237, 22, 28, 34, 46],
  blue: [237, 17, 19, 27, 39],
  purple: [237, 54, 91, 128, 171],
  orange: [237, 94, 130, 166, 214],
  mono: null,
} as const;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export const PLAIN_CELLS =["·", "░", "▒", "▓", "█"] as const;

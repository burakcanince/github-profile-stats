import { BAR_WIDTH, MONTHS, PLAIN_CELLS, THEMES, WEEKDAYS, type ThemeName } from "./constants.js";
import { formatDays, parseDateKey, rangeLabel } from "./dates.js";
import type { CompareRow } from "./report.js";
import type {
  ContributionDay,
  ContributionLevel,
  ContributionSummary,
  LanguageShare,
  Options,
  Report,
  TopRepo,
  UserStats,
} from "./types.js";

type Colorize = (text: string | number) => string;

type CalendarWeek = (ContributionDay | null)[];

export interface Style {
  heading: Colorize;
  label: Colorize;
  value: Colorize;
  error: Colorize;
  chartBar: Colorize;
  calendarCell: (level: ContributionLevel) => string;
}

export function createStyle(colorsEnabled: boolean, themeName: ThemeName): Style {
  const ansi =
    (code: string): Colorize =>
    (text) =>
      colorsEnabled ? `\x1b[${code}m${text}\x1b[0m` : String(text);
  const themeColors = colorsEnabled ? THEMES[themeName] : null;

  return {
    heading: ansi("1"),
    label: ansi("2"),
    value: ansi("36"),
    error: ansi("31"),
    chartBar: (text) => (themeColors ? `\x1b[38;5;${themeColors[4]}m${text}\x1b[0m` : String(text)),
    calendarCell: (level) =>
      themeColors ? `\x1b[38;5;${themeColors[level]}m■\x1b[0m` : PLAIN_CELLS[level],
  };
}

export function printReport(report: Report, style: Style): void {
  const labelWidth = Math.max(...report.rows.map(([label]) => label.length)) + 1;
  console.log(style.heading(report.title));
  for (const [label, value] of report.rows) {
    console.log(`  ${style.label(`${label}:`.padEnd(labelWidth))} ${style.value(value)}`);
  }
}

function printBarChart(title: string, entries: [label: string, value: number][], style: Style): void {
  console.log(style.heading(title));
  const maxValue = Math.max(1, ...entries.map(([, value]) => value));
  const labelWidth = Math.max(...entries.map(([label]) => label.length));
  const valueWidth = Math.max(...entries.map(([, value]) => String(value).length));
  for (const [label, value] of entries) {
    const bar = "▅".repeat(Math.round((value / maxValue) * BAR_WIDTH));
    console.log(`  ${label.padEnd(labelWidth)}  ${String(value).padStart(valueWidth)}  ${style.chartBar(bar)}`);
  }
}

function groupIntoWeeks(days: ContributionDay[]): CalendarWeek[] {
  const emptyDaysBeforeStart = parseDateKey(days[0].date).getDay();
  const cells: CalendarWeek = [...Array<null>(emptyDaysBeforeStart).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: CalendarWeek[] = [];
  for (let start = 0; start < cells.length; start += 7) weeks.push(cells.slice(start, start + 7));
  return weeks;
}

function buildMonthHeader(weeks: CalendarWeek[]): string {
  const header = Array<string>(weeks.length * 2).fill(" ");
  let previousMonth = -1;
  let nextFreeColumn = 0;
  weeks.forEach((week, weekIndex) => {
    const firstDay = week.find((cell): cell is ContributionDay => cell !== null);
    if (!firstDay) return;
    const month = parseDateKey(firstDay.date).getMonth();
    if (month === previousMonth) return;
    previousMonth = month;
    const column = weekIndex * 2;
    if (column < nextFreeColumn || column + 3 > header.length) return;
    for (let offset = 0; offset < 3; offset++) header[column + offset] = MONTHS[month][offset];
    nextFreeColumn = column + 4;
  });
  return header.join("").trimEnd();
}

function printCalendar(
  days: ContributionDay[],
  contributions: ContributionSummary,
  options: Options,
  style: Style
): void {
  console.log(style.heading(`Contribution calendar ${rangeLabel(options.year)}`));
  if (days.length === 0) {
    console.log("  No contribution data for this range.");
    return;
  }

  const weeks = groupIntoWeeks(days);
  console.log(`       ${buildMonthHeader(weeks)}`);
  WEEKDAYS.forEach((weekdayName, weekday) => {
    const row = weeks
      .map((week) => {
        const day = week[weekday];
        return day ? style.calendarCell(day.level) : " ";
      })
      .join(" ");
    console.log(`  ${weekdayName}  ${row}`);
  });

  const levels: ContributionLevel[] = [0, 1, 2, 3, 4];
  console.log(`       Less ${levels.map((level) => style.calendarCell(level)).join(" ")} More`);
  const maxPerDay = contributions.bestDay?.count ?? 0;
  console.log(
    style.label(
      `  Contributions: ${contributions.total} | Longest streak: ${formatDays(contributions.longestStreak)} | Current streak: ${formatDays(contributions.currentStreak)} | Max a day: ${maxPerDay}`
    )
  );
}

function printWeekdays(contributions: ContributionSummary, style: Style): void {
  const entries = Object.entries(contributions.weekdays).sort((first, second) => second[1] - first[1]);
  printBarChart("Contributions by weekday", entries, style);
}

function printMonthly(contributions: ContributionSummary, style: Style): void {
  const entries = contributions.months.map(({ month, count }): [string, number] => {
    const [year, monthNumber] = month.split("-");
    return [`${MONTHS[Number(monthNumber) - 1]} ${year}`, count];
  });
  printBarChart("Contributions by month", entries, style);
}

function printLanguages(languages: LanguageShare[], style: Style): void {
  const title = "Languages (repos)";
  if (languages.length === 0) {
    console.log(style.heading(title));
    console.log("  No language data.");
    return;
  }
  const entries = languages.map((language): [string, number] => [
    `${language.name} (${language.percentage}%)`,
    language.repos,
  ]);
  printBarChart(title, entries, style);
}

function printTopRepos(repos: TopRepo[], style: Style): void {
  console.log(style.heading("Top repositories"));
  if (repos.length === 0) {
    console.log("  No repositories.");
    return;
  }
  const nameWidth = Math.max(...repos.map((repo) => repo.name.length));
  const starsWidth = Math.max(...repos.map((repo) => String(repo.stars).length));
  const forksWidth = Math.max(...repos.map((repo) => String(repo.forks).length));
  repos.forEach((repo, index) => {
    const rank = String(index + 1).padStart(2);
    const stars = `${String(repo.stars).padStart(starsWidth)} stars`;
    const forks = `${String(repo.forks).padStart(forksWidth)} forks`;
    console.log(`  ${rank}. ${repo.name.padEnd(nameWidth)}  ${style.value(stars)}  ${forks}`);
  });
}

export function printUserSections(stats: UserStats, options: Options, style: Style): void {
  const sections: (() => void)[] = [];
  const { contributions, rangeDays, repoSummary } = stats;

  if ((options.calendar || options.weekday || options.monthly) && !contributions) {
    sections.push(() => console.log(style.label("Contribution data is unavailable right now.")));
  }
  if (contributions && rangeDays) {
    if (options.calendar) sections.push(() => printCalendar(rangeDays, contributions, options, style));
    if (options.weekday) sections.push(() => printWeekdays(contributions, style));
    if (options.monthly) sections.push(() => printMonthly(contributions, style));
  }
  if (options.languages) sections.push(() => printLanguages(repoSummary.languages, style));
  if (options.top) sections.push(() => printTopRepos(repoSummary.topRepos.slice(0, options.top), style));

  for (const printSection of sections) {
    console.log("");
    printSection();
  }
}

export function printComparison(first: UserStats, second: UserStats, rows: CompareRow[], style: Style): void {
  const usernames = [first.user.login, second.user.login];
  const labelWidth = Math.max(...rows.map(([label]) => label.length)) + 1;
  const columnWidth =
    Math.max(
      ...usernames.map((username) => username.length),
      ...rows.flatMap(([, firstValue, secondValue]) => [
        String(firstValue ?? "-").length,
        String(secondValue ?? "-").length,
      ])
    ) + 2;

  const formatCell = (value: number | null, otherValue: number | null): string => {
    const text = (value === null ? "-" : String(value)).padEnd(columnWidth);
    const isHigher = value !== null && otherValue !== null && value > otherValue;
    return isHigher ? style.value(text) : text;
  };

  console.log(style.heading(`GitHub Profile Comparison: ${usernames[0]} vs ${usernames[1]}`));
  console.log(
    `  ${"".padEnd(labelWidth)} ${style.heading(usernames[0].padEnd(columnWidth))}${style.heading(usernames[1])}`
  );
  for (const [label, firstValue, secondValue] of rows) {
    console.log(
      `  ${style.label(`${label}:`.padEnd(labelWidth))} ${formatCell(firstValue, secondValue)}${formatCell(secondValue, firstValue).trimEnd()}`
    );
  }
  const tiers = [first.devScore.tier, second.devScore.tier];
  console.log(`  ${style.label("Tier:".padEnd(labelWidth))} ${tiers[0].padEnd(columnWidth)}${tiers[1]}`);
}

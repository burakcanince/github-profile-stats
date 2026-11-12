import { CONTRIBUTIONS_API, USER_AGENT, WEEKDAYS } from "./constants.js";
import { addDays, parseDateKey, toDateKey } from "./dates.js";
import type { ContributionDay, ContributionLevel, ContributionSummary } from "./types.js";

interface ContributionsResponse {
  contributions: { date: string; count: number; level: number }[];
}

function toLevel(level: number): ContributionLevel {
  return Math.min(4, Math.max(0, Math.round(level))) as ContributionLevel;
}

export async function fetchContributionDays(username: string): Promise<ContributionDay[] | null> {
  try {
    const response = await fetch(`${CONTRIBUTIONS_API}/${encodeURIComponent(username)}?y=all`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as ContributionsResponse;
    const todayKey = toDateKey(new Date());
    return body.contributions
      .filter((day) => day.date <= todayKey)
      .map((day) => ({ date: day.date, count: day.count, level: toLevel(day.level) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}

export function selectRange(days: ContributionDay[], year: number | null): ContributionDay[] {
  if (year) {
    const prefix = `${year}-`;
    return days.filter((day) => day.date.startsWith(prefix));
  }
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const startKey = toDateKey(addDays(oneYearAgo, -oneYearAgo.getDay()));
  return days.filter((day) => day.date >= startKey);
}

function longestStreak(days: ContributionDay[]): number {
  let longest = 0;
  let running = 0;
  for (const day of days) {
    running = day.count > 0 ? running + 1 : 0;
    longest = Math.max(longest, running);
  }
  return longest;
}

function currentStreak(days: ContributionDay[]): number {
  const counts = new Map(days.map((day) => [day.date, day.count]));
  let cursor = new Date();
  if (!counts.get(toDateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while ((counts.get(toDateKey(cursor)) ?? 0) > 0) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function summarizeContributions(
  rangeDays: ContributionDay[],
  allDays: ContributionDay[]
): ContributionSummary {
  const weekdays = WEEKDAYS.map(() => 0);
  const months = new Map<string, number>();
  let total = 0;
  let activeDays = 0;
  let bestDay: ContributionSummary["bestDay"] = null;

  for (const day of rangeDays) {
    total += day.count;
    weekdays[parseDateKey(day.date).getDay()] += day.count;
    const monthKey = day.date.slice(0, 7);
    months.set(monthKey, (months.get(monthKey) ?? 0) + day.count);
    if (day.count > 0) {
      activeDays++;
      if (!bestDay || day.count > bestDay.count) bestDay = { date: day.date, count: day.count };
    }
  }

  return {
    total,
    activeDays,
    totalDays: rangeDays.length,
    longestStreak: longestStreak(rangeDays),
    currentStreak: currentStreak(allDays),
    bestDay,
    weekdays: Object.fromEntries(WEEKDAYS.map((name, index) => [name, weekdays[index]])),
    months: Array.from(months, ([month, count]) => ({ month, count })),
  };
}

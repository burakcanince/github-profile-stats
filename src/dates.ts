import { DAY_MS } from "./constants.js";

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function sinceDate(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export function rangeLabel(year: number | null): string {
  return year ? `in ${year}` : "in the last year";
}

export function formatDays(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

const DAY = 24 * 60 * 60 * 1000;

/** ISO timestamp `days` before `now`, at the given UTC wall-clock time (defaults to now's time). */
export function daysAgo(now: Date, days: number, hh?: number, mm = 0): string {
  const d = new Date(now.getTime() - days * DAY);
  if (hh !== undefined) d.setUTCHours(hh, mm, 0, 0);
  return d.toISOString();
}

export function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

/** Calendar days (UTC) between two instants — the same count the UI shows as "N days ago". */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso.slice(0, 10)) - Date.parse(fromIso.slice(0, 10))) / DAY);
}

function sameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function clock(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/** "today at 09:02", "yesterday at 16:40", "6 days ago" — times shown in UTC so UI and speech agree. */
export function formatRelative(iso: string, nowIso: string): string {
  const d = new Date(iso);
  const now = new Date(nowIso);
  if (sameUtcDay(d, now)) return `today at ${clock(d)}`;
  const yesterday = new Date(now.getTime() - DAY);
  if (sameUtcDay(d, yesterday)) return `yesterday at ${clock(d)}`;
  return `${daysBetween(iso, nowIso)} days ago`;
}

/** "Oct 19, 16:40" */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${d.getUTCDate()}, ${clock(d)}`;
}

/** "Thu 29 Oct" */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  const wd = d.toLocaleString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${wd} ${d.getUTCDate()} ${month}`;
}

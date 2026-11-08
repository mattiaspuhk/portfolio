// Content dates are calendar dates parsed as UTC midnight, so format in UTC to avoid off-by-one days.
const dateFormat = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const monthYearFormat = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** A project's stand on the apron, from its `order`: 1 → "01". */
export const standNumber = (order: number) => String(order).padStart(2, '0');

/** For `<time datetime>`. */
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Day first, to match the British spelling in the copy: "20 Sep 2026". The en-GB locale writes "Sept". */
export function formatDate(date: Date) {
  const parts = Object.fromEntries(
    dateFormat.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.day} ${parts.month} ${parts.year}`;
}

export const formatMonthYear = (date: Date) => monthYearFormat.format(date);

/** "YYYY-MM" from cv.yaml. Anything else is returned unchanged. */
export function formatYearMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return formatMonthYear(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1)));
}

/** `end` missing means the period is ongoing. */
export function formatRange(start: string, end: string | undefined, present: string) {
  return `${start} – ${end ?? present}`;
}

export function formatPeriod(period: { start: Date; end?: Date }, present: string) {
  return formatRange(
    formatMonthYear(period.start),
    period.end && formatMonthYear(period.end),
    present,
  );
}

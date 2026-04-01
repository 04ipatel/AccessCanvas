/**
 * Formats a Canvas ISO timestamp as 'YYYY-MM-DD H:MM AM/PM TZ'
 * in the specified IANA timezone (e.g. 'America/New_York').
 * Returns null for null inputs (assignments without due dates).
 */
export function formatDateTime(isoString: string | null, timezone: string): string | null {
  if (isoString === null) return null;

  const d = new Date(isoString);

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(d);

  return `${date} ${time}`;
}

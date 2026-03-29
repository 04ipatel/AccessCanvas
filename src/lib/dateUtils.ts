/**
 * Converts a Canvas ISO timestamp to a local date string (YYYY-MM-DD).
 * Canvas returns UTC timestamps; this converts to the system's local timezone
 * so dates display correctly regardless of UTC offset.
 */
export function localDateFromISO(isoString: string): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoString));
}

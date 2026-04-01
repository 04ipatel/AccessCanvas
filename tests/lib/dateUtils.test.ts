import { describe, it, expect } from 'vitest';

describe('formatDateTime', () => {
  it('formats UTC timestamp as date+time+timezone abbreviation', async () => {
    const { formatDateTime } = await import('../../src/lib/dateUtils.js');
    // 2026-04-01T03:59:00Z in EDT (America/New_York, UTC-4) = 2026-03-31 11:59 PM EDT
    expect(formatDateTime('2026-04-01T03:59:00Z', 'America/New_York')).toBe('2026-03-31 11:59 PM EDT');
  });

  it('returns null for null input', async () => {
    const { formatDateTime } = await import('../../src/lib/dateUtils.js');
    expect(formatDateTime(null, 'America/New_York')).toBeNull();
  });

  it('uses the specified timezone, not system timezone', async () => {
    const { formatDateTime } = await import('../../src/lib/dateUtils.js');
    // Same UTC instant in two different timezones should differ
    const ny = formatDateTime('2026-04-01T03:59:00Z', 'America/New_York');
    const la = formatDateTime('2026-04-01T03:59:00Z', 'America/Los_Angeles');
    // NY: 11:59 PM EDT (UTC-4); LA: 8:59 PM PDT (UTC-7)
    expect(ny).toContain('EDT');
    expect(la).toContain('PDT');
    expect(ny).toContain('2026-03-31');
    expect(la).toContain('2026-03-31');
  });

  it('formats a midday time correctly', async () => {
    const { formatDateTime } = await import('../../src/lib/dateUtils.js');
    // 2026-03-25T07:59:59-04:00 = 2026-03-25 7:59 AM EDT in America/New_York
    expect(formatDateTime('2026-03-25T07:59:59-04:00', 'America/New_York')).toBe('2026-03-25 7:59 AM EDT');
  });
});

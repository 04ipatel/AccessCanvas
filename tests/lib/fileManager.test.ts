// tests/lib/fileManager.test.ts
import { describe, it, expect } from 'vitest';

describe('sanitizeName', () => {
  it('replaces spaces with underscores', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('Risk Management')).toBe('RiskManagement');
  });

  it('removes special characters', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('Course: 101 & More!')).toBe('Course101More');
  });

  it('preserves dots, hyphens, and underscores in filenames', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('assignment_2.qmd')).toBe('assignment_2.qmd');
  });
});

describe('getLocalPath', () => {
  it('builds correct path under ~/Academics', async () => {
    const { getLocalPath } = await import('../../src/lib/fileManager.js');
    const path = getLocalPath('Risk Management', 'Assignment 2', 'Assignment 2.pdf');
    expect(path).toContain('Academics');
    expect(path).toContain('RiskManagement');
    expect(path).toContain('Assignment2');
    expect(path).toContain('Assignment2.pdf');
  });
});

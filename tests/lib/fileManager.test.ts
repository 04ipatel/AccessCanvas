// tests/lib/fileManager.test.ts
import { describe, it, expect } from 'vitest';

describe('sanitizeName', () => {
  it('removes spaces', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('Risk Management')).toBe('RiskManagement');
  });

  it('removes special characters', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('Course: 101 & More!')).toBe('Course101More');
  });

  it('preserves dots, hyphens, and underscores', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('assignment_2.qmd')).toBe('assignment_2.qmd');
  });
});

describe('getLocalPath', () => {
  it('builds path under the provided downloadDir', async () => {
    const { getLocalPath } = await import('../../src/lib/fileManager.js');
    const path = getLocalPath('FIN4507', 'Risk Management', 'Assignment 2', 'Assignment 2.pdf', '/tmp/TestAcademics');
    expect(path).toContain('TestAcademics');
    expect(path).toContain('FIN4507-RiskManagement');
    expect(path).toContain('Assignment2');
    expect(path).toContain('Assignment2.pdf');
  });
});

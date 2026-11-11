import { describe, it, expect } from 'vitest';
import { classifyBackupStatus, summarizeBackupObjects } from './backups';

describe('summarizeBackupObjects', () => {
  it('aggregates count, bytes and the latest modification timestamp', () => {
    const summary = summarizeBackupObjects([
      { size: 100, lastModified: new Date('2026-10-01T10:00:00Z') },
      { size: 250, lastModified: new Date('2026-10-03T10:00:00Z') },
      { size: 50, lastModified: new Date('2026-10-02T10:00:00Z') },
    ]);
    expect(summary.objectCount).toBe(3);
    expect(summary.totalBytes).toBe(400);
    expect(summary.latestObjectAt).toBe('2026-10-03T10:00:00.000Z');
  });

  it('handles an empty listing without inventing timestamps', () => {
    const summary = summarizeBackupObjects([]);
    expect(summary).toEqual({ objectCount: 0, totalBytes: 0, latestObjectAt: null });
  });

  it('tolerates objects with missing size or invalid dates', () => {
    const summary = summarizeBackupObjects([{ size: undefined, lastModified: null }, { lastModified: 'not-a-date' }]);
    expect(summary.objectCount).toBe(2);
    expect(summary.totalBytes).toBe(0);
    expect(summary.latestObjectAt).toBeNull();
  });
});

describe('classifyBackupStatus', () => {
  it('reports ok when objects exist', () => {
    expect(classifyBackupStatus({ objectCount: 12 })).toBe('ok');
  });

  it('reports empty when the listing is clean but has no objects', () => {
    expect(classifyBackupStatus({ objectCount: 0 })).toBe('empty');
  });

  it('reports error whenever the storage call failed, regardless of counts', () => {
    expect(classifyBackupStatus({ objectCount: 0, error: 'Missing B2 bucket configuration.' })).toBe('error');
    expect(classifyBackupStatus({ objectCount: 5, error: 'Access denied.' })).toBe('error');
  });
});

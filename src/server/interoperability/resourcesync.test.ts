import { describe, it, expect } from 'vitest';
import { generateCapabilityList, generateCapabilityListXml, generateSourceDescriptionXml, generateResourceListXml } from '@/server/interoperability/resourcesync';

describe('resourcesync', () => {
  it('generates capability list with 3 capabilities', () => {
    const caps = generateCapabilityList('https://example.com');
    expect(caps).toHaveLength(3);
    expect(caps[0].capability).toBe('resourcelist');
    expect(caps[1].capability).toBe('changelist');
  });

  it('generates valid capability list XML', () => {
    const xml = generateCapabilityListXml('https://example.com');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('capabilitylist');
    expect(xml).toContain('resourcelist');
  });

  it('generates valid source description XML', () => {
    const xml = generateSourceDescriptionXml('https://example.com');
    expect(xml).toContain('capability="description"');
    expect(xml).toContain('capabilitylist.xml');
  });

  it('generates resource list XML with resources', () => {
    const resources = [{ id: 'abc', handle: 'test/1', updated_at: '2026-01-01' }];
    const xml = generateResourceListXml('https://example.com', resources);
    expect(xml).toContain('/repository/test%2F1');
    expect(xml).toContain('capability="resource"');
  });
});

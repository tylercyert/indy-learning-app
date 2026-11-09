import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPONENT_MANIFESTS, type ComponentType } from '../../../src/contracts';
import { EXPERIENCE_SYSTEM } from './prompts';

/**
 * Catalog completeness (#8, docs/components.md): every component type the contract allows is
 * explained to the generator and has at least one stress fixture. The compiler covers the
 * manifest table and the slide renderer.
 */
const types = Object.keys(COMPONENT_MANIFESTS) as ComponentType[];
const fixtureDir = path.resolve(__dirname, '../../../qa/fixtures/stress');
const fixtures = fs
  .readdirSync(fixtureDir)
  .filter((f) => f.endsWith('.json') && !f.startsWith('invalid-'))
  .map((f) => fs.readFileSync(path.join(fixtureDir, f), 'utf8'));

describe('component catalog completeness', () => {
  it.each(types)('%s is described in the generation prompt', (type) => {
    expect(EXPERIENCE_SYSTEM).toContain(type);
  });

  it.each(types)('%s has a stress fixture', (type) => {
    expect(fixtures.some((json) => json.includes(`"type": "${type}"`) || json.includes(`"type":"${type}"`))).toBe(true);
  });
});

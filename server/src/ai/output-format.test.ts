import { describe, expect, it } from 'vitest';
import { CoursePlanV1Schema, GeneratedSlidesV1Schema, IntakeTurnV1Schema } from '../../../src/contracts';
import { outputJsonSchema } from './output-format';

function walk(node: unknown, visit: (key: string, value: unknown) => void): void {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      visit(k, v);
      walk(v, visit);
    }
  }
}

describe('outputJsonSchema', () => {
  it.each([
    ['intake', IntakeTurnV1Schema],
    ['plan', CoursePlanV1Schema],
    ['slides', GeneratedSlidesV1Schema],
  ])('strips length/pattern/range constraints but keeps shape for %s', (_name, schema) => {
    const json = outputJsonSchema(schema);
    const keys = new Set<string>();
    walk(json, (k) => keys.add(k));
    for (const banned of ['minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'minItems', 'maxItems', 'format', 'oneOf']) {
      expect(keys.has(banned), banned).toBe(false);
    }
    expect(keys.has('properties')).toBe(true);
    expect(keys.has('required')).toBe(true);
    expect(keys.has('enum')).toBe(true);
    // Discriminated unions must survive as anyOf so the model still sees the variants.
    if (_name !== 'plan') expect(keys.has('anyOf')).toBe(true);
  });

  it('marks every property required so the API sees zero optional parameters', () => {
    for (const schema of [IntakeTurnV1Schema, CoursePlanV1Schema, GeneratedSlidesV1Schema]) {
      let optional = 0;
      walk(outputJsonSchema(schema), (k, v) => {
        if (k !== 'properties' || !v || typeof v !== 'object') return;
        // find the sibling `required` by walking the parent: emulate by checking each object node below
      });
      const check = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(check);
        if (node && typeof node === 'object') {
          const rec = node as Record<string, unknown>;
          if (rec.type === 'object' && rec.properties && typeof rec.properties === 'object') {
            const props = Object.keys(rec.properties as Record<string, unknown>);
            const req = new Set((rec.required as string[] | undefined) ?? []);
            optional += props.filter((p) => !req.has(p)).length;
          }
          Object.values(rec).forEach(check);
        }
      };
      check(outputJsonSchema(schema));
      expect(optional).toBe(0);
    }
  });

  it('keeps additionalProperties: false on strict objects and keeps property names intact', () => {
    const json = outputJsonSchema(GeneratedSlidesV1Schema) as { properties?: Record<string, unknown>; additionalProperties?: boolean };
    expect(json.additionalProperties).toBe(false);
    expect(Object.keys(json.properties ?? {})).toEqual(['slides']);
    const text = JSON.stringify(json);
    expect(text).toContain('"correctOptionId"');
    expect(text).toContain('"altText"');
  });
});

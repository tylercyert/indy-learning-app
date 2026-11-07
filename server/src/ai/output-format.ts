import { z } from 'zod';

/**
 * Builds the structured-output JSON Schema from a Zod contract.
 *
 * The API accepts a JSON Schema subset and compiles it to a grammar, with limits:
 * no oneOf (anyOf is fine), at most 24 optional properties, at most 16 union-typed
 * properties, and a cap on compiled grammar size. Our contracts carry tighter constraints
 * (lengths, patterns, refinements) that the subset cannot express; those are stripped here
 * and enforced by the full Zod parse after the response arrives. Every property is marked
 * required (model-facing optionals are plain optionals, so the model sends an empty value).
 * Shared sub-schemas are emitted as $defs to keep the grammar small.
 */
const STRIPPED_KEYS = new Set([
  'minLength', 'maxLength', 'pattern', 'format',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minItems', 'maxItems', 'uniqueItems',
  'minProperties', 'maxProperties',
  '$schema', 'id', '$id',
]);

function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    const record = node as Record<string, unknown>;
    if (record.type === 'object' && record.properties && typeof record.properties === 'object') {
      out.required = Object.keys(record.properties as Record<string, unknown>);
    }
    for (const [key, value] of Object.entries(record)) {
      if (key === 'required') continue;
      if (STRIPPED_KEYS.has(key)) continue;
      // `properties` and `$defs` keys are names, never keywords: recurse into values only.
      if ((key === 'properties' || key === '$defs') && value && typeof value === 'object') {
        const named: Record<string, unknown> = {};
        for (const [name, sub] of Object.entries(value as Record<string, unknown>)) named[name] = strip(sub);
        out[key] = named;
        continue;
      }
      // Zod emits oneOf for discriminated unions; the API accepts only anyOf.
      out[key === 'oneOf' ? 'anyOf' : key] = strip(value);
    }
    return out;
  }
  return node;
}

export function outputJsonSchema(schema: z.ZodType, opts: { refs?: boolean } = {}): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    unrepresentable: 'any',
    io: 'input',
    // Grammar mode rejects $defs under anyOf, so inline by default; prompt mode uses refs for brevity.
    reused: opts.refs ? 'ref' : 'inline',
  });
  return strip(raw) as Record<string, unknown>;
}

/** Compact schema text for prompt-guided JSON when the grammar path is unavailable. */
export function schemaForPrompt(schema: z.ZodType): string {
  return JSON.stringify(outputJsonSchema(schema, { refs: true }));
}

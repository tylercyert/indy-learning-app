import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { aiEnabled } from '../env';
import { outputJsonSchema, schemaForPrompt } from './output-format';

/**
 * The only place the platform talks to a model.
 * Every call asks for structured output against a Zod contract and validates the result
 * with that same contract before anything downstream sees it. The model's output is data,
 * never instructions and never code.
 *
 * Two output modes, chosen per schema:
 *   grammar: the API constrains decoding to the JSON Schema (output_config.format).
 *   prompt:  the schema is given in the system prompt and the model replies with JSON only.
 * Large schemas exceed the API's grammar limits; when the API rejects a schema, the call
 * falls back to prompt mode and remembers that choice for the schema.
 */
export const MODEL = 'claude-opus-5-5';

export type Effort = 'low' | 'medium' | 'high';
type Mode = 'grammar' | 'prompt';

export class GenerationError extends Error {
  constructor(
    public readonly kind: 'disabled' | 'refused' | 'truncated' | 'invalid' | 'api',
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!aiEnabled) throw new GenerationError('disabled', 'AI generation is disabled (no ANTHROPIC_API_KEY)');
  client ??= new Anthropic();
  return client;
}

const modeBySchema = new WeakMap<z.ZodType, Mode>();

export interface StructuredRequest<S extends z.ZodType> {
  /** Short label for logs and the `generatedBy` audit field. */
  task: string;
  schema: S;
  /** Stable instructions: cached across calls. Keep volatile content in `messages`. */
  system: string;
  messages: Anthropic.MessageParam[];
  effort: Effort;
  maxTokens?: number;
  /** One retry with the validation issues fed back is the default; 0 disables it. */
  retries?: number;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  mode: Mode;
  usage: { input: number; output: number; cacheRead: number };
  attempts: number;
}

function isSchemaRejection(error: InstanceType<typeof Anthropic.APIError>): boolean {
  return error.status === 400 && /schema|grammar|optional parameters|union types/i.test(error.message);
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

export async function generateStructured<S extends z.ZodType>(
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const anthropic = getClient();
  const maxAttempts = 1 + (req.retries ?? 1);
  const messages: Anthropic.MessageParam[] = [...req.messages];
  let mode: Mode = modeBySchema.get(req.schema) ?? 'grammar';
  const maxTokens = req.maxTokens ?? 32_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let message: Anthropic.Message;
    try {
      message = await callOnce(anthropic, req, messages, mode, maxTokens);
    } catch (error) {
      if (error instanceof Anthropic.APIError && mode === 'grammar' && isSchemaRejection(error)) {
        console.warn(`[generation] ${req.task}: schema rejected for grammar mode (${error.message.slice(0, 120)}); using prompt mode`);
        mode = 'prompt';
        modeBySchema.set(req.schema, mode);
        attempt--; // the fallback is not a validation retry
        continue;
      }
      if (error instanceof Anthropic.APIError) {
        throw new GenerationError('api', `${req.task}: API error ${error.status ?? ''} ${error.message}`, error);
      }
      throw error;
    }

    if (message.stop_reason === 'refusal') {
      throw new GenerationError('refused', `${req.task}: the model declined this request`, message.stop_details);
    }
    if (message.stop_reason === 'max_tokens') {
      throw new GenerationError('truncated', `${req.task}: output hit max_tokens (${maxTokens})`);
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const json = extractJson(text);
    const parsed = json === undefined ? null : req.schema.safeParse(json);

    if (parsed?.success) {
      return {
        data: parsed.data,
        model: message.model,
        mode,
        usage: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
          cacheRead: message.usage.cache_read_input_tokens ?? 0,
        },
        attempts: attempt,
      };
    }

    const issues = parsed
      ? parsed.error.issues.slice(0, 25).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      : ['response was not valid JSON'];

    if (attempt === maxAttempts) {
      throw new GenerationError('invalid', `${req.task}: output failed validation after ${attempt} attempt(s)`, issues);
    }

    console.warn(`[generation] ${req.task}: attempt ${attempt} failed validation (${issues.length} issues); retrying`);
    messages.push({ role: 'assistant', content: message.content });
    messages.push({
      role: 'user',
      content: `Your previous output did not satisfy the contract. Fix exactly these issues and return the full corrected JSON object, nothing else:\n- ${issues.join('\n- ')}`,
    });
  }
  throw new GenerationError('invalid', `${req.task}: unreachable`);
}

async function callOnce<S extends z.ZodType>(
  anthropic: Anthropic,
  req: StructuredRequest<S>,
  messages: Anthropic.MessageParam[],
  mode: Mode,
  maxTokens: number,
): Promise<Anthropic.Message> {
  const system: Anthropic.TextBlockParam[] =
    mode === 'grammar'
      ? [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }]
      : [
          { type: 'text', text: req.system },
          {
            type: 'text',
            text: `Respond with a single JSON object and nothing else: no prose, no code fences. It must validate against this JSON Schema (every property is required; use empty arrays/strings where you have nothing to say):\n${schemaForPrompt(req.schema)}`,
            cache_control: { type: 'ephemeral' },
          },
        ];
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config:
      mode === 'grammar'
        ? { effort: req.effort, format: { type: 'json_schema', schema: outputJsonSchema(req.schema) } }
        : { effort: req.effort },
    system,
    messages,
  });
  return stream.finalMessage();
}

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { aiEnabled } from '../env';

/**
 * The only place the platform talks to a model.
 * Every call asks for structured output against a Zod contract and validates the result
 * with that same contract before anything downstream sees it. The model's output is data,
 * never instructions and never code.
 */
export const MODEL = 'claude-opus-5-5';

export type Effort = 'low' | 'medium' | 'high';

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
  usage: { input: number; output: number; cacheRead: number };
  attempts: number;
}

export async function generateStructured<S extends z.ZodType>(
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const anthropic = getClient();
  const maxAttempts = 1 + (req.retries ?? 1);
  const messages: Anthropic.MessageParam[] = [...req.messages];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let message: Anthropic.Message;
    try {
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: req.maxTokens ?? 32_000,
        thinking: { type: 'adaptive' },
        output_config: { effort: req.effort, format: zodOutputFormat(req.schema) },
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages,
      });
      message = await stream.finalMessage();
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new GenerationError('api', `${req.task}: API error ${error.status ?? ''} ${error.message}`, error);
      }
      throw error;
    }

    if (message.stop_reason === 'refusal') {
      throw new GenerationError('refused', `${req.task}: the model declined this request`, message.stop_details);
    }
    if (message.stop_reason === 'max_tokens') {
      throw new GenerationError('truncated', `${req.task}: output hit max_tokens (${req.maxTokens ?? 32_000})`);
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    const parsed = json === undefined ? null : req.schema.safeParse(json);

    if (parsed?.success) {
      return {
        data: parsed.data,
        model: message.model,
        usage: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
          cacheRead: message.usage.cache_read_input_tokens ?? 0,
        },
        attempts: attempt,
      };
    }

    const issues = parsed
      ? parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      : ['response was not valid JSON'];

    if (attempt === maxAttempts) {
      throw new GenerationError('invalid', `${req.task}: output failed validation after ${attempt} attempt(s)`, issues);
    }

    // Feed the exact issues back and try once more. The assistant turn is replayed verbatim.
    messages.push({ role: 'assistant', content: message.content });
    messages.push({
      role: 'user',
      content: `Your previous output did not satisfy the contract. Fix exactly these issues and return the full corrected object:\n- ${issues.join('\n- ')}`,
    });
  }
  throw new GenerationError('invalid', `${req.task}: unreachable`);
}

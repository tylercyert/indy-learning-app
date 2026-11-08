/**
 * Repairs one recurring slip in prompt-mode JSON: a run of closing brackets with one or two too many
 * in it. Seen in server logs on 2026-11-07 after a multipleChoice options array, e.g.
 *   ..."explanation":"…"}]}]}},{"id":"path-ahead",…      (one extra "}")
 *   ..."explanation":"…"}]}]}]},{"id":"orange-swap",…    (an extra "]}" that closes the document early)
 * It was the main reason slide generation failed validation twice (the retry repeated the same slip)
 * and a course arrived with its first lesson still being written (#68).
 *
 * The parser's error position is the oracle: at each failure, try deleting one, then two, closers from
 * the run of closing brackets just before the error, and keep the edit that lets parsing get furthest.
 * Bounded, and only ever deletes closing brackets outside strings. The result is still validated
 * against the Zod contract by the caller; this only fixes syntax. Model output stays data.
 */

const CLOSERS = new Set(['}', ']']);
const MAX_REPAIRS = 6;
const MAX_RUN = 12;

type Attempt = { ok: true; value: unknown } | { ok: false; at: number };

function tryParse(text: string): Attempt {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const match = /position (\d+)/.exec(e instanceof Error ? e.message : '');
    return { ok: false, at: match ? Number(match[1]) : -1 };
  }
}

/** Indices of the closing brackets in the run that ends at or just before `at` (whitespace allowed). */
function closerRun(text: string, at: number): number[] {
  const run: number[] = [];
  let i = Math.min(at, text.length - 1);
  if (i >= 0 && !CLOSERS.has(text[i]!)) i--;
  for (; i >= 0 && run.length < MAX_RUN; i--) {
    const ch = text[i]!;
    if (CLOSERS.has(ch)) run.unshift(i);
    else if (!/\s/.test(ch)) break;
  }
  return run;
}

/** The text with the characters at `drop` (UTF-16 indices, as JSON.parse reports them) removed. */
function without(text: string, drop: number[]): string {
  let out = '';
  let from = 0;
  for (const i of [...drop].sort((a, b) => a - b)) {
    out += text.slice(from, i);
    from = i + 1;
  }
  return out + text.slice(from);
}

export function parseWithCloserRepair(text: string): unknown {
  let current = text;
  let attempt = tryParse(current);
  for (let round = 0; round < MAX_REPAIRS && !attempt.ok; round++) {
    const failedAt = attempt.at;
    if (failedAt < 0) return undefined;
    const run = closerRun(current, failedAt);
    if (run.length === 0) return undefined;
    const singles = run.map((i) => [i]);
    const pairs = run.flatMap((a, k) => run.slice(k + 1).map((b) => [a, b]));
    // Smallest edit first: the first candidate that parses wins. Otherwise keep the one that lets the
    // parser get furthest, measured in the original text (every deletion sits before the error).
    let best: { text: string; at: number } | null = null;
    for (const drop of [...singles, ...pairs]) {
      const candidate = without(current, drop);
      const result = tryParse(candidate);
      if (result.ok) return result.value;
      const reached = result.at + drop.length;
      if (reached > failedAt && (!best || reached > best.at)) best = { text: candidate, at: reached };
    }
    if (!best) return undefined;
    current = best.text;
    attempt = tryParse(current);
  }
  return attempt.ok ? attempt.value : undefined;
}

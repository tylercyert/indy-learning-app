/**
 * The celebration's one-line recap (#20): what the learner can do now, from the lesson's learning
 * objective. Planned objectives state a capability as an imperative ("Use acid to fix a drink that
 * tastes flat"), which reads naturally after "You can now". A leading subject ("Learners will…") is
 * dropped; a topic-style objective ("How engines work") gets "You worked on…" instead of a broken
 * sentence. Pure, so it is tested in node.
 */

const MAX_RECAP = 170;

/** Leading phrases that name a subject; the capability starts after them. */
const SUBJECT_PREFIXES = [
  /^(?:the\s+)?(?:learners?|students?)\s+(?:will|can|should|is able to|are able to)\s+(?:be\s+able\s+to\s+)?/i,
  /^you(?:'ll|\s+will|\s+can|\s+should)\s+(?:be\s+able\s+to\s+)?/i,
  /^(?:be\s+)?able\s+to\s+/i,
  /^to\s+/i,
];

/** First words that start a topic or a noun phrase rather than a capability. */
const NOT_A_VERB = new Set(['the', 'a', 'an', 'how', 'what', 'why', 'when', 'where', 'which', 'who', 'your', 'my', 'our', 'this', 'these', 'basics', 'introduction', 'overview', 'fundamentals']);

export function recapFromObjective(objective: string | null | undefined): string | null {
  let text = (objective ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return null;
  text = text.replace(/[.!\s]+$/, '');
  for (const prefix of SUBJECT_PREFIXES) text = text.replace(prefix, '');
  if (!text) return null;
  const word = text.split(' ')[0]!;
  const first = word.toLowerCase().replace(/[^a-z']/g, '');
  // An acronym or a name up front ("SQL joins", "iOS apps") starts a topic, not a capability.
  const named = word.slice(1) !== word.slice(1).toLowerCase();
  const verbLike = first.length > 1 && !named && !NOT_A_VERB.has(first) && !/(?:ing|tion|sion|ness|ment)$/.test(first);
  const lead = named ? text : `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  const line = verbLike ? `You can now ${lead}` : `You worked on ${lead}`;
  return `${clip(line)}${/[?!]$/.test(line) ? '' : '.'}`;
}

function clip(s: string): string {
  if (s.length <= MAX_RECAP) return s;
  const cut = s.slice(0, MAX_RECAP);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}

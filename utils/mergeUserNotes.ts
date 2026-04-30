export type AnsweredQuestion = {
  type: 'choice' | 'text';
  /**
   * Template like "drawn to {answer}" or "must include {answer}".
   * Lowercase, starts with a verb or preposition. The {answer} placeholder
   * is replaced with the joined values (single value, "X and Y" for 2,
   * Oxford-comma "X, Y, and Z" for 3+).
   */
  summarizePattern: string;
  /**
   * For 'choice': the selected option labels (length 1 for single-select,
   * length ≥ 1 for multi-select; length 0 means the question was skipped).
   * For 'text': a one-element array of the typed text (or [''] when blank).
   */
  values: string[];
};

/**
 * Merge the user's original notes with their refinement answers into a single
 * prose brief.
 *
 *   "I like nature" + answers → "I like nature. Drawn to mountains, preferring an active pace."
 *
 * Pure function — deterministic, no I/O.
 */
export function mergeUserNotes(
  original: string,
  answers: AnsweredQuestion[],
): string {
  const trimmedOriginal = original.trim();

  const fragments = answers
    .map(buildFragment)
    .filter((f): f is string => f !== null);

  if (trimmedOriginal === '' && fragments.length === 0) {
    return '';
  }

  const originalWithPeriod = trimmedOriginal === ''
    ? ''
    : endsWithPunctuation(trimmedOriginal)
      ? trimmedOriginal
      : `${trimmedOriginal}.`;

  if (fragments.length === 0) {
    return originalWithPeriod;
  }

  const joined = fragments.join(', ');
  const capitalized = capitalizeFirstLetter(joined);
  const continuation = `${capitalized}.`;

  return originalWithPeriod === ''
    ? continuation
    : `${originalWithPeriod} ${continuation}`;
}

function buildFragment(answer: AnsweredQuestion): string | null {
  const cleanValues = answer.values
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (cleanValues.length === 0) return null;

  const interpolatedValues =
    answer.type === 'choice'
      ? cleanValues.map(lowercaseFirstLetter)
      : cleanValues;

  return answer.summarizePattern.replace(
    '{answer}',
    joinAnswerValues(interpolatedValues),
  );
}

function joinAnswerValues(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  const head = values.slice(0, -1).join(', ');
  const tail = values[values.length - 1];
  return `${head}, and ${tail}`;
}

function endsWithPunctuation(s: string): boolean {
  if (s.length === 0) return true;
  const last = s[s.length - 1];
  return last === '.' || last === '!' || last === '?';
}

function lowercaseFirstLetter(s: string): string {
  if (s.length === 0) return s;
  return s[0].toLowerCase() + s.slice(1);
}

function capitalizeFirstLetter(s: string): string {
  if (s.length === 0) return s;
  return s[0].toUpperCase() + s.slice(1);
}

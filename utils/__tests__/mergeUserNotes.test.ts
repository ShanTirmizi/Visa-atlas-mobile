import { mergeUserNotes, type AnsweredQuestion } from '../mergeUserNotes';

describe('mergeUserNotes', () => {
  describe('with no answers', () => {
    it('returns original text with a period when none was present', () => {
      expect(mergeUserNotes('I like nature', [])).toBe('I like nature.');
    });

    it('preserves trailing punctuation', () => {
      expect(mergeUserNotes('I like nature.', [])).toBe('I like nature.');
      expect(mergeUserNotes('Wow!', [])).toBe('Wow!');
      expect(mergeUserNotes('Really?', [])).toBe('Really?');
    });

    it('strips trailing whitespace before adding the period', () => {
      expect(mergeUserNotes('I like nature   ', [])).toBe('I like nature.');
    });

    it('returns an empty string when the original is empty', () => {
      expect(mergeUserNotes('', [])).toBe('');
      expect(mergeUserNotes('   ', [])).toBe('');
    });
  });

  describe('with single-select choice answer', () => {
    it('appends a capitalized fragment from the pattern', () => {
      const answers: AnsweredQuestion[] = [
        {
          type: 'choice',
          summarizePattern: 'preferring {answer}',
          values: ['an active pace'],
        },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe(
        'I like nature. Preferring an active pace.',
      );
    });
  });

  describe('with multi-select choice answer', () => {
    it('uses "X and Y" joining for 2 picks', () => {
      const answers: AnsweredQuestion[] = [
        {
          type: 'choice',
          summarizePattern: 'drawn to {answer}',
          values: ['mountains and hiking', 'forests and wildlife'],
        },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe(
        'I like nature. Drawn to mountains and hiking and forests and wildlife.',
      );
    });

    it('uses Oxford-comma joining for 3+ picks', () => {
      const answers: AnsweredQuestion[] = [
        {
          type: 'choice',
          summarizePattern: 'drawn to {answer}',
          values: ['mountains', 'beaches', 'forests'],
        },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe(
        'I like nature. Drawn to mountains, beaches, and forests.',
      );
    });
  });

  describe('with text answer', () => {
    it('preserves typed proper nouns', () => {
      const answers: AnsweredQuestion[] = [
        {
          type: 'text',
          summarizePattern: 'must include {answer}',
          values: ['Königssee'],
        },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe(
        'I like nature. Must include Königssee.',
      );
    });
  });

  describe('with mixed answer types', () => {
    it('joins multiple fragments with commas, period at end', () => {
      const answers: AnsweredQuestion[] = [
        {
          type: 'choice',
          summarizePattern: 'drawn to {answer}',
          values: ['mountains and hiking', 'forests and wildlife'],
        },
        {
          type: 'choice',
          summarizePattern: 'preferring {answer}',
          values: ['an active pace'],
        },
        {
          type: 'text',
          summarizePattern: 'must include {answer}',
          values: ['Königssee'],
        },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe(
        'I like nature. Drawn to mountains and hiking and forests and wildlife, preferring an active pace, must include Königssee.',
      );
    });
  });

  describe('with skipped answers', () => {
    it('omits answers whose values array is empty', () => {
      const answers: AnsweredQuestion[] = [
        { type: 'choice', summarizePattern: 'drawn to {answer}', values: [] },
        {
          type: 'choice',
          summarizePattern: 'preferring {answer}',
          values: ['an active pace'],
        },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe(
        'I like nature. Preferring an active pace.',
      );
    });

    it('omits answers whose values are blank strings', () => {
      const answers: AnsweredQuestion[] = [
        { type: 'text', summarizePattern: 'must include {answer}', values: ['  '] },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe('I like nature.');
    });

    it('returns original text only when all answers are blank/empty', () => {
      const answers: AnsweredQuestion[] = [
        { type: 'choice', summarizePattern: 'drawn to {answer}', values: [] },
        { type: 'text', summarizePattern: 'must include {answer}', values: [''] },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe('I like nature.');
    });
  });

  describe('case handling', () => {
    it('lowercases the first letter of choice answers when interpolating', () => {
      const answers: AnsweredQuestion[] = [
        {
          type: 'choice',
          summarizePattern: 'drawn to {answer}',
          values: ['Mountains and Hiking'],
        },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe(
        'I like nature. Drawn to mountains and Hiking.',
      );
    });

    it('preserves case in text answers', () => {
      const answers: AnsweredQuestion[] = [
        {
          type: 'text',
          summarizePattern: 'must include {answer}',
          values: ['Königssee'],
        },
      ];
      expect(mergeUserNotes('I like nature', answers)).toBe(
        'I like nature. Must include Königssee.',
      );
    });
  });
});

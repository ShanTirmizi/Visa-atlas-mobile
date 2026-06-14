// Tokenizer-level tests for the chat markdown renderer — the belt that keeps
// raw markers (the asterisks users complained about) out of the bubble.
import { tokenize, stripOrphans } from '@/components/ui/MarkdownText';

const text = (s: string) => ({ type: 'text', text: s });

describe('MarkdownText tokenize', () => {
  it('parses paired bold/italic/code', () => {
    expect(tokenize('a **b** c')).toEqual([
      text('a '),
      { type: 'bold', text: 'b' },
      text(' c'),
    ]);
    expect(tokenize('_hi_')).toEqual([{ type: 'italic', text: 'hi' }]);
    expect(tokenize('`code`')).toEqual([{ type: 'code', text: 'code' }]);
  });

  it('parses ***bolditalic*** without leaking markers', () => {
    expect(tokenize('***wow***')).toEqual([{ type: 'bolditalic', text: 'wow' }]);
  });

  it('parses links into a link token', () => {
    expect(tokenize('see [docs](https://x.com)')).toEqual([
      text('see '),
      { type: 'link', text: 'docs', url: 'https://x.com' },
    ]);
  });

  it('keeps nested emphasis as inner text for recursive rendering', () => {
    // **buy the _Gold_ pass** → bold token whose inner still has the _italic_
    expect(tokenize('**buy the _Gold_ pass**')).toEqual([
      { type: 'bold', text: 'buy the _Gold_ pass' },
    ]);
    expect(tokenize('buy the _Gold_ pass')).toEqual([
      text('buy the '),
      { type: 'italic', text: 'Gold' },
      text(' pass'),
    ]);
  });

  it('does NOT italicize intraword underscores (identifiers / URLs)', () => {
    expect(tokenize('report_card_2026')).toEqual([text('report_card_2026')]);
    expect(tokenize('https://x/a_b_c')).toEqual([text('https://x/a_b_c')]);
    expect(tokenize('snake_case')).toEqual([text('snake_case')]);
  });

  it('leaves an unpaired marker as plain text (stripped at render)', () => {
    // No close → no token; the whole thing is text, cleaned by stripOrphans.
    const toks = tokenize('**bold start with no close');
    expect(toks).toEqual([text('**bold start with no close')]);
    expect(stripOrphans(toks[0].text)).toBe('bold start with no close');
  });
});

describe('stripOrphans', () => {
  it('removes runs of 2+ asterisks/underscores and backticks', () => {
    expect(stripOrphans('**leak')).toBe('leak');
    expect(stripOrphans('a *** b')).toBe('a  b');
    expect(stripOrphans('`x')).toBe('x');
  });
  it('leaves lone single * / _ (could be literal math / filenames)', () => {
    expect(stripOrphans('2 * 3 = 6')).toBe('2 * 3 = 6');
    expect(stripOrphans('a_b')).toBe('a_b');
  });
});

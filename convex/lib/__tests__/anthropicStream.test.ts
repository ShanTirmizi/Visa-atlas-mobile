import { describe, expect, it } from '@jest/globals';
import {
  buildItineraryUserPrompt,
  buildSystemPrompt,
  makeItineraryStreamParser,
  makeWholeSectionBuffer,
} from '../anthropicStream';

describe('makeItineraryStreamParser', () => {
  it('emits each day as it completes', () => {
    const days: Array<[number, string]> = [];
    const errs: Error[] = [];
    const cb = makeItineraryStreamParser(
      (idx, json) => days.push([idx, json]),
      (err) => errs.push(err),
    );
    // Simulate a streamed array of two days, split arbitrarily
    cb.onDelta('[{"title":"D1","mor');
    cb.onDelta('ning":"x"},{"title":"D2","morning":"y"}]');
    cb.onComplete();
    expect(errs).toEqual([]);
    expect(days).toHaveLength(2);
    expect(JSON.parse(days[0][1])).toEqual({ title: 'D1', morning: 'x' });
    expect(JSON.parse(days[1][1])).toEqual({ title: 'D2', morning: 'y' });
  });

  it('handles strings with embedded braces', () => {
    const days: Array<[number, string]> = [];
    const cb = makeItineraryStreamParser(
      (idx, json) => days.push([idx, json]),
      () => {},
    );
    cb.onDelta('[{"title":"a {b} c","x":1}]');
    cb.onComplete();
    expect(days).toHaveLength(1);
    expect(JSON.parse(days[0][1])).toEqual({ title: 'a {b} c', x: 1 });
  });

  it('handles escaped quotes in strings', () => {
    const days: Array<[number, string]> = [];
    const cb = makeItineraryStreamParser(
      (idx, json) => days.push([idx, json]),
      () => {},
    );
    cb.onDelta('[{"title":"a \\"b\\" c","x":1}]');
    cb.onComplete();
    expect(days).toHaveLength(1);
    expect(JSON.parse(days[0][1])).toEqual({ title: 'a "b" c', x: 1 });
  });
});

describe('makeWholeSectionBuffer', () => {
  it('concatenates all deltas and trims', () => {
    let result = '';
    const cb = makeWholeSectionBuffer((full) => { result = full; }, () => {});
    cb.onDelta('  {"a"');
    cb.onDelta(': 1}');
    cb.onComplete();
    expect(result).toBe('{"a": 1}');
  });
});

const baseInput = {
  countryCode: 'DE',
  countryName: 'Germany',
  capital: 'Berlin',
  duration: 7,
  vibe: 'balanced',
  budget: 'mid',
  interests: 'food, culture',
  activityStyles: ['walking'],
  travelParty: 'couple',
  heldVisas: [],
};

describe('buildSystemPrompt with userNotes', () => {
  it('omits the userNotes block when notes are absent', () => {
    const prompt = buildSystemPrompt(baseInput);
    expect(prompt).not.toContain('shared specific requests');
  });

  it('omits the userNotes block when notes are whitespace-only', () => {
    const prompt = buildSystemPrompt({ ...baseInput, userNotes: '   ' });
    expect(prompt).not.toContain('shared specific requests');
  });

  it('includes the userNotes block verbatim when notes are present', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      userNotes: 'Just Berlin and Munich, slow pace',
    });
    expect(prompt).toContain('shared specific requests');
    expect(prompt).toContain('"Just Berlin and Munich, slow pace"');
    expect(prompt).toContain("Honor these requests where they don't conflict");
  });
});

describe('buildItineraryUserPrompt with userNotes', () => {
  it('omits the reminder when notes are absent', () => {
    const prompt = buildItineraryUserPrompt(baseInput);
    expect(prompt).not.toContain('Remember the user');
  });

  it('appends the reminder when notes are present', () => {
    const prompt = buildItineraryUserPrompt({
      ...baseInput,
      userNotes: 'Foodie focus',
    });
    expect(prompt).toContain('Remember the user');
    expect(prompt).toContain('"Foodie focus"');
  });
});

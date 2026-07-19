import { describe, expect, it } from 'vitest';

import { describeTyping } from '@/lib/typing';

/**
 * Phase 2 (typing indicators) — the pure label rule. Names arrive already resolved to
 * how the viewer knows each person; this only phrases them and drops blanks.
 */
describe('describeTyping', () => {
  it('shows nothing when no one is typing', () => {
    expect(describeTyping([])).toBe('');
  });

  it('names a single typer', () => {
    expect(describeTyping(['Bob'])).toBe('Bob is typing…');
  });

  it('joins two typers with "and"', () => {
    expect(describeTyping(['Bob', 'Carol'])).toBe(
      'Bob and Carol are typing…',
    );
  });

  it('lists exactly three typers', () => {
    expect(describeTyping(['Bob', 'Carol', 'Dee'])).toBe(
      'Bob, Carol and Dee are typing…',
    );
  });

  it('collapses four or more to a generic phrase', () => {
    expect(describeTyping(['Bob', 'Carol', 'Dee', 'Eve'])).toBe(
      'Several people are typing…',
    );
  });

  it('ignores blank names so a missing roster name never renders', () => {
    expect(describeTyping(['Bob', '   ', ''])).toBe('Bob is typing…');
    expect(describeTyping(['', '  '])).toBe('');
  });
});

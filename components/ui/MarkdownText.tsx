// components/ui/MarkdownText.tsx
//
// A small, dependency-free markdown renderer for CHAT BUBBLES. The trip /
// visa copilots are now prompted to reply in plain prose, but models drift —
// this is the belt-and-suspenders layer so a stray **bold**, a pipe-table, or
// a `---` rule never leaks raw glyphs into the bubble again (the exact bug
// users reported: "I don't think the user is supposed to see the asterisk").
//
// Scope is deliberately the subset a chat reply actually produces — bold,
// italic, inline code, links, bullet/numbered lists, headings, block quotes,
// horizontal rules, and pipe-tables flattened to readable lines. It is NOT a
// full CommonMark engine; for rich documents use a real library. Text stays
// `selectable` so long-press-to-copy works (iMessage / ChatGPT behaviour).

import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { FontFamily } from '@/constants/theme';

interface MarkdownTextProps {
  text: string;
  /** Base paragraph style (font family / size / lineHeight / color). */
  baseStyle: TextStyle;
  /** Colour for links and inline-code text. */
  accentColor: string;
  /** Muted colour for list bullets / quote bars / rules. */
  mutedColor: string;
  /** Subtle fill behind inline code. */
  codeBg: string;
  selectable?: boolean;
}

// ── Inline tokenizer ────────────────────────────────────────────────
// Matches, longest delimiter first: ***bolditalic***, **bold**, `code`,
// [text](url), *italic*, _italic_ (and __ / ___ variants). Hermes has no
// regex lookbehind, so the intraword-underscore guard is done in JS, not in
// the pattern. Bold/italic inner text is re-tokenized (recursion) so nested
// emphasis renders instead of leaking its markers.
const INLINE_RE =
  /(\*\*\*[^*]+?\*\*\*|___[^_]+?___|\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+?`|\[[^\]]+?\]\([^)\s]+?\)|\*[^*\n]+?\*|_[^_\n]+?_)/g;

type TokenType = 'text' | 'bold' | 'italic' | 'bolditalic' | 'code' | 'link';
interface Token {
  type: TokenType;
  text: string;
  url?: string;
}

const isWordChar = (c: string | undefined): boolean => !!c && /[A-Za-z0-9]/.test(c);

// Strip orphan markdown markers (a `**`/`__` whose pair never matched, a
// dangling backtick) from a plain-text run so the literal glyphs never reach
// the bubble. Paired markers are already consumed as tokens, so a run of 2+
// asterisks/underscores left here is an artifact. Lone single `*`/`_` are
// left alone (could be real: "2 * 3", a filename). No lookbehind — Hermes.
export const stripOrphans = (s: string): string => s.replace(/\*\*+|__+|`/g, '');

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(input)) !== null) {
    const raw = m[0];
    // Intraword underscore (report_card_2026, a_b in a URL) is NOT emphasis.
    const usesUnderscore = raw[0] === '_';
    if (usesUnderscore) {
      const before = input[m.index - 1];
      const after = input[m.index + raw.length];
      if (isWordChar(before) || isWordChar(after)) {
        // Leave it in the surrounding text run; don't advance `last`.
        continue;
      }
    }
    if (m.index > last) tokens.push({ type: 'text', text: input.slice(last, m.index) });

    if (raw.startsWith('***') || raw.startsWith('___')) {
      tokens.push({ type: 'bolditalic', text: raw.slice(3, -3) });
    } else if (raw.startsWith('**') || raw.startsWith('__')) {
      tokens.push({ type: 'bold', text: raw.slice(2, -2) });
    } else if (raw.startsWith('`')) {
      tokens.push({ type: 'code', text: raw.slice(1, -1) });
    } else if (raw.startsWith('[')) {
      const close = raw.indexOf('](');
      tokens.push({
        type: 'link',
        text: raw.slice(1, close),
        url: raw.slice(close + 2, -1),
      });
    } else {
      tokens.push({ type: raw[0] === '*' || raw[0] === '_' ? 'italic' : 'text', text: raw.slice(1, -1) });
    }
    last = m.index + raw.length;
  }
  if (last < input.length) tokens.push({ type: 'text', text: input.slice(last) });
  return tokens;
}

function InlineRun({
  text,
  baseStyle,
  accentColor,
  codeBg,
}: {
  text: string;
  baseStyle: TextStyle;
  accentColor: string;
  codeBg: string;
}): React.ReactElement {
  const tokens = useMemo(() => tokenize(text), [text]);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.type === 'text') {
          return <Text key={i}>{stripOrphans(t.text)}</Text>;
        }
        if (t.type === 'link') {
          const href = t.url ?? '';
          return (
            <Text
              key={i}
              onPress={() => Linking.openURL(href).catch(() => {})}
              style={{ color: accentColor, textDecorationLine: 'underline', fontFamily: FontFamily.medium }}
            >
              {t.text}
            </Text>
          );
        }
        if (t.type === 'code') {
          return (
            <Text
              key={i}
              style={{
                fontFamily: FontFamily.mono,
                color: accentColor,
                backgroundColor: codeBg,
                fontSize: (baseStyle.fontSize ?? 14) - 1,
              }}
            >
              {t.text}
            </Text>
          );
        }
        // bold / italic / bolditalic — recurse so nested emphasis renders and
        // its markers don't leak. Style merges by nesting (fontStyle for
        // italic so it composes with a bold ancestor's font face).
        const style: TextStyle = {};
        if (t.type === 'bold' || t.type === 'bolditalic') style.fontFamily = FontFamily.semibold;
        if (t.type === 'italic' || t.type === 'bolditalic') style.fontStyle = 'italic';
        return (
          <Text key={i} style={style}>
            <InlineRun text={t.text} baseStyle={baseStyle} accentColor={accentColor} codeBg={codeBg} />
          </Text>
        );
      })}
    </>
  );
}

// ── Block parsing ───────────────────────────────────────────────────

type Block =
  | { type: 'heading'; text: string; level: number }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'rule' }
  | { type: 'paragraph'; text: string };

const RULE_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/; // ---  ***  ___
const TABLE_SEP_RE = /^\s*\|?[\s:|-]+\|?\s*$/; // |---|:--|

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.includes('|', 1);
}

/** Flatten a pipe-table row to "cell · cell · cell" — chat bubbles can't
 *  render a grid, and a flattened line is far better than raw pipes. */
function flattenTableRow(line: string): string {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean)
    .join('  ·  ');
}

function parseBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ type: 'paragraph', text: para.join(' ').trim() });
      para = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      flushPara();
      i++;
      continue;
    }
    if (RULE_RE.test(trimmed)) {
      flushPara();
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }
    // Table: a separator row is dropped, data rows flatten to paragraphs.
    if (isTableRow(trimmed)) {
      flushPara();
      while (i < lines.length && isTableRow(lines[i].trim())) {
        const row = lines[i].trim();
        if (!TABLE_SEP_RE.test(row.replace(/\|/g, '|'))) {
          const flat = flattenTableRow(row);
          if (flat) blocks.push({ type: 'paragraph', text: flat });
        }
        i++;
      }
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      blocks.push({ type: 'heading', text: heading[2].trim(), level: heading[1].length });
      i++;
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flushPara();
      blocks.push({ type: 'quote', text: trimmed.replace(/^>\s?/, '') });
      i++;
      continue;
    }
    // Unordered list (-, *, •) or ordered (1.)
    const isUl = /^[-*•]\s+/.test(trimmed);
    const isOl = /^\d+[.)]\s+/.test(trimmed);
    if (isUl || isOl) {
      flushPara();
      const items: string[] = [];
      const ordered = isOl;
      while (i < lines.length) {
        const t = lines[i].trim();
        const ulm = t.match(/^[-*•]\s+(.*)$/);
        const olm = t.match(/^\d+[.)]\s+(.*)$/);
        if (ordered && olm) items.push(olm[1]);
        else if (!ordered && ulm) items.push(ulm[1]);
        else break;
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    para.push(trimmed);
    i++;
  }
  flushPara();
  return blocks;
}

// ── Component ───────────────────────────────────────────────────────

export function MarkdownText({
  text,
  baseStyle,
  accentColor,
  mutedColor,
  codeBg,
  selectable = true,
}: MarkdownTextProps) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const gap = 8;

  return (
    <View>
      {blocks.map((block, bi) => {
        const isFirst = bi === 0;
        const mt = isFirst ? 0 : gap;
        if (block.type === 'rule') {
          return (
            <View
              key={bi}
              style={[styles.rule, { backgroundColor: mutedColor, marginTop: mt + 2, marginBottom: 2 }]}
            />
          );
        }
        if (block.type === 'heading') {
          return (
            <Text
              key={bi}
              selectable={selectable}
              style={[
                baseStyle,
                {
                  marginTop: mt,
                  fontFamily: FontFamily.semibold,
                  fontSize: (baseStyle.fontSize ?? 14) + (block.level <= 2 ? 1.5 : 0.5),
                },
              ]}
            >
              <InlineRun text={block.text} baseStyle={baseStyle} accentColor={accentColor} codeBg={codeBg} />
            </Text>
          );
        }
        if (block.type === 'quote') {
          return (
            <View key={bi} style={[styles.quoteRow, { marginTop: mt }]}>
              <View style={[styles.quoteBar, { backgroundColor: mutedColor }]} />
              <Text selectable={selectable} style={[baseStyle, { flex: 1, color: mutedColor, fontStyle: 'italic' }]}>
                <InlineRun text={block.text} baseStyle={baseStyle} accentColor={accentColor} codeBg={codeBg} />
              </Text>
            </View>
          );
        }
        if (block.type === 'list') {
          return (
            <View key={bi} style={{ marginTop: mt, gap: 4 }}>
              {block.items.map((item, ii) => (
                <View key={ii} style={styles.listRow}>
                  <Text style={[baseStyle, { color: mutedColor, width: block.ordered ? 22 : 14 }]}>
                    {block.ordered ? `${ii + 1}.` : '•'}
                  </Text>
                  <Text selectable={selectable} style={[baseStyle, { flex: 1 }]}>
                    <InlineRun text={item} baseStyle={baseStyle} accentColor={accentColor} codeBg={codeBg} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={bi} selectable={selectable} style={[baseStyle, { marginTop: mt }]}>
            <InlineRun text={block.text} baseStyle={baseStyle} accentColor={accentColor} codeBg={codeBg} />
          </Text>
        );
      })}
    </View>
  );
}

export default MarkdownText;

const styles = StyleSheet.create({
  rule: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  quoteRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quoteBar: {
    width: 2,
    borderRadius: 1,
    alignSelf: 'stretch',
  },
  listRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
});

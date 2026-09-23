export type TextPart = { text: string; math: false } | { text: string; math: true; display: boolean };

/** Splits text into plain and LaTeX parts: `$inline$` and `$$display$$`. Unbalanced `$` stays text. */
export function splitMath(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), math: false });
    parts.push({ text: match[1] ?? match[2], math: true, display: match[1] !== undefined });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), math: false });
  return parts;
}

export const hasMath = (text: string) => text.includes("$");

"use client";

import katex from "katex";
import { splitMath } from "@/lib/math-text";

/** Renders `$…$` / `$$…$$` segments with KaTeX. Loaded lazily, only when text contains math. */
export default function KatexText({ text }: { text: string }) {
  return (
    <>
      {splitMath(text).map((part, index) =>
        part.math ? (
          <span
            key={index}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.text, { throwOnError: false, displayMode: part.display }),
            }}
          />
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

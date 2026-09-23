"use client";

import { lazy, Suspense } from "react";
import { hasMath } from "@/lib/math-text";

const KatexText = lazy(() => import("./katex-text"));

/** Text that may contain LaTeX. Plain text renders instantly; KaTeX is only downloaded if needed. */
export function MathText({ text }: { text: string }) {
  if (!hasMath(text)) return <>{text}</>;
  return (
    <Suspense fallback={text}>
      <KatexText text={text} />
    </Suspense>
  );
}

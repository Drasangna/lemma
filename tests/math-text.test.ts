import assert from "node:assert/strict";
import test from "node:test";
import { hasMath, splitMath } from "../lib/math-text";

test("plain text is a single part", () => {
  assert.deepEqual(splitMath("No formulas here."), [{ text: "No formulas here.", math: false }]);
  assert.equal(hasMath("No formulas here."), false);
});

test("inline and display math are separated from surrounding text", () => {
  assert.deepEqual(splitMath("Then $e(G) \\le n^2/4$ and $$\\sum_i x_i$$ done"), [
    { text: "Then ", math: false },
    { text: "e(G) \\le n^2/4", math: true, display: false },
    { text: " and ", math: false },
    { text: "\\sum_i x_i", math: true, display: true },
    { text: " done", math: false },
  ]);
});

test("an unbalanced dollar sign stays plain text", () => {
  assert.deepEqual(splitMath("It costs $5 to run"), [{ text: "It costs $5 to run", math: false }]);
});

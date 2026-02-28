import type { ClozeResult } from "../../types/index.js";

const CLOZE_PATTERN = /\{\{c\d+::([^:}]+)(?:::([^}]*))?\}\}/g;

export function parseCloze(clozeText: string): ClozeResult {
  if (!clozeText) return { displayText: clozeText ?? "", answers: [] };

  const answers: string[] = [];
  const displayText = clozeText.replace(CLOZE_PATTERN, (_match, answer, hint) => {
    answers.push(answer);
    return `[${hint ?? "..."}]`;
  });

  return { displayText, answers };
}

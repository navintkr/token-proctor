// Cheap, dependency-free token estimator.
// Rule of thumb: ~4 chars per token for English/code. Good to ±15%.
// Swap for `tiktoken` or `@anthropic-ai/tokenizer` when exact counts matter.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const base = Math.ceil(chars / 4);
  // bump slightly for code-heavy text (lots of punctuation inflates tokens)
  const codePenalty =
    (text.match(/[{}()<>\[\];:=]/g)?.length ?? 0) / Math.max(chars, 1);
  return Math.ceil(base * (1 + Math.min(codePenalty * 0.5, 0.2)));
}

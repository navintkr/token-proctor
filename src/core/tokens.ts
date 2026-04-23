// Token estimator.
// v0.1 behavior: cheap `chars/4` heuristic (kept as fallback).
// v0.3: optional exact counts via `js-tiktoken` — caller installs the
// encoder via `setTokenizer`. If installation fails (missing dep), we
// silently fall back to the heuristic.

export type TokenizeFn = (text: string) => number;

let activeTokenizer: TokenizeFn | null = null;

/** Install an exact tokenizer. Called once at startup by participant/mcp-server. */
export function setTokenizer(fn: TokenizeFn | null): void {
  activeTokenizer = fn;
}

/** True if an exact tokenizer is installed. */
export function isExactTokenization(): boolean {
  return activeTokenizer !== null;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  if (activeTokenizer) {
    try {
      return activeTokenizer(text);
    } catch {
      // fall through to heuristic
    }
  }
  const chars = text.length;
  const base = Math.ceil(chars / 4);
  // bump slightly for code-heavy text (lots of punctuation inflates tokens)
  const codePenalty =
    (text.match(/[{}()<>\[\];:=]/g)?.length ?? 0) / Math.max(chars, 1);
  return Math.ceil(base * (1 + Math.min(codePenalty * 0.5, 0.2)));
}

/**
 * Try to install `js-tiktoken` as the active tokenizer.
 * Returns true on success. Safe to call multiple times.
 * Uses dynamic import so the dep is optional at runtime.
 */
export async function tryInstallTiktoken(
  encoding: "cl100k_base" | "o200k_base" = "o200k_base"
): Promise<boolean> {
  try {
    const mod = await import("js-tiktoken");
    const enc = mod.getEncoding ? mod.getEncoding(encoding) : null;
    if (!enc || typeof enc.encode !== "function") return false;
    setTokenizer((text: string) => enc.encode(text).length);
    return true;
  } catch {
    return false;
  }
}

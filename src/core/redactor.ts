// v0.2 — Secret redactor.
// Built-in patterns for common credential shapes; extendable via policy.

export interface Redaction {
  kind: string;                 // label for the finding
  count: number;                // how many times it matched
}

export interface RedactResult {
  text: string;                 // redacted text (same length ≈; substrings replaced with [REDACTED:kind])
  redactions: Redaction[];
  redactedCount: number;
}

interface Pattern {
  kind: string;
  re: RegExp;
}

// Safe, widely-used detectors. Each regex is bounded to avoid catastrophic backtracking.
// NOTE: we deliberately do NOT include a generic "40-char base64" AWS-secret-key
// pattern — it false-positives on ordinary prose/code. If you need it, add via
// policy.redact.patterns scoped to lines containing "aws_secret_access_key".
const BUILTIN_PATTERNS: Pattern[] = [
  { kind: "aws-access-key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: "aws-secret-key", re: /\baws_secret_access_key\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi },
  { kind: "github-token",   re: /\bghp_[A-Za-z0-9]{30,255}\b/g },
  { kind: "github-oauth",   re: /\bgho_[A-Za-z0-9]{30,255}\b/g },
  { kind: "openai-key",     re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { kind: "slack-token",    re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: "pem-block",      re: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g },
  { kind: "jwt",            re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { kind: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: "stripe-key",     re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
];

export interface RedactOptions {
  builtins?: boolean;           // default true
  extraPatterns?: string[];     // regex strings
}

export function redact(text: string, opts: RedactOptions = {}): RedactResult {
  const useBuiltins = opts.builtins !== false;
  const counts = new Map<string, number>();
  let out = text;

  const patterns: Pattern[] = [];
  if (useBuiltins) patterns.push(...BUILTIN_PATTERNS);

  for (const src of opts.extraPatterns ?? []) {
    try {
      patterns.push({ kind: `custom:${truncate(src, 32)}`, re: new RegExp(src, "g") });
    } catch {
      // ignore malformed user regex
    }
  }

  for (const { kind, re } of patterns) {
    out = out.replace(re, () => {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      return `[REDACTED:${kind}]`;
    });
  }

  const redactions: Redaction[] = [...counts.entries()].map(([kind, count]) => ({ kind, count }));
  const redactedCount = redactions.reduce((n, r) => n + r.count, 0);
  return { text: out, redactions, redactedCount };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

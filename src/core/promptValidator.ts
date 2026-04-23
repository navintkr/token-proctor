import { ValidationResult, ValidationDimension } from "./types.js";

// Dimension scoring. Each dimension returns [score 0..100, note].
// Heuristics only — cheap and explainable. Treat as a lint, not an oracle.

function scoreGoalClarity(p: string): [number, string] {
  const hasImperative = /\b(add|fix|implement|refactor|write|create|remove|update|rename|explain|debug|compare|optimize|generate|convert|migrate|document|test)\b/i.test(p);
  const hasConcreteNoun = /\b(function|class|method|file|endpoint|component|test|query|schema|bug|error|module|script|api)\b/i.test(p);
  let s = 20;
  if (hasImperative) s += 40;
  if (hasConcreteNoun) s += 30;
  if (p.trim().split(/\s+/).length >= 6) s += 10;
  return [Math.min(s, 100),
    hasImperative && hasConcreteNoun ? "clear goal" : "goal is fuzzy — start with a verb + what thing"];
}

function scoreScope(p: string): [number, string] {
  const mentionsFile = /\b[\w.\-/]+\.(ts|tsx|js|jsx|py|go|rs|java|cs|rb|php|cpp|c|h|md|yaml|yml|json|sql)\b/.test(p);
  const mentionsSymbol = /\b[A-Z][a-zA-Z0-9_]{2,}\b/.test(p) || /`[^`]+`/.test(p);
  const hasSuccessCriteria = /\b(so that|should|must|when .* then|done when|such that|pass(es)?|returns?)\b/i.test(p);
  let s = 20;
  if (mentionsFile) s += 35;
  if (mentionsSymbol) s += 25;
  if (hasSuccessCriteria) s += 20;
  return [Math.min(s, 100),
    mentionsFile ? "scope is concrete" : "no file/function named — scope is unclear"];
}

function scoreContext(p: string, attachedChars = 0): [number, string] {
  const hasCodeBlock = /```/.test(p);
  const hasError = /\b(error|exception|stack ?trace|traceback|failed)\b/i.test(p);
  const hasIO = /\b(input|output|expected|actual|got|returns?)\b/i.test(p);
  let s = 10;
  if (attachedChars > 200) s += 40;
  if (hasCodeBlock) s += 25;
  if (hasError) s += 15;
  if (hasIO) s += 15;
  return [Math.min(s, 100),
    attachedChars > 200 || hasCodeBlock ? "has supporting context" :
      "no code/context attached — consider pasting the file or error"];
}

function scoreConstraints(p: string): [number, string] {
  const lang = /\b(typescript|javascript|python|go|rust|java|c#|ruby|php|swift|kotlin|c\+\+|sql)\b/i.test(p);
  const style = /\b(style|convention|lint|prettier|eslint|black|ruff|format|async|sync|pure|immutable)\b/i.test(p);
  let s = 40;
  if (lang) s += 35;
  if (style) s += 25;
  return [Math.min(s, 100),
    lang ? "language/constraints present" : "language not stated (may be inferable from workspace)"];
}

function scoreAcceptance(p: string): [number, string] {
  const hasAccept = /\b(done when|acceptance|must pass|should return|expected( output)?|example)\b/i.test(p);
  return [hasAccept ? 90 : 40,
    hasAccept ? "has acceptance criteria" : "no acceptance criteria — add a test or expected output"];
}

function scoreAmbiguity(p: string): [number, string] {
  const vaguePronouns = (p.match(/\b(it|this|that|those|them|the thing)\b/gi) ?? []).length;
  const words = Math.max(p.trim().split(/\s+/).length, 1);
  const ratio = vaguePronouns / words;
  const s = Math.max(20, 100 - ratio * 600);
  return [Math.round(s),
    ratio > 0.1 ? "too many vague pronouns (it/this/that)" : "language is specific"];
}

export interface ValidateOptions {
  attachedChars?: number;
  threshold?: number;     // default 60
  hardBlock?: number;     // default 25 — below this, refuse to proceed
}

export function validate(prompt: string, opts: ValidateOptions = {}): ValidationResult {
  const threshold = opts.threshold ?? 60;
  const hardBlock = opts.hardBlock ?? 25;

  const dims: ValidationDimension[] = [
    dim("Goal clarity", 25, ...scoreGoalClarity(prompt)),
    dim("Scope",        20, ...scoreScope(prompt)),
    dim("Context",      20, ...scoreContext(prompt, opts.attachedChars ?? 0)),
    dim("Constraints",  15, ...scoreConstraints(prompt)),
    dim("Acceptance",   10, ...scoreAcceptance(prompt)),
    dim("Ambiguity",    10, ...scoreAmbiguity(prompt)),
  ];

  const total = dims.reduce((acc, d) => acc + (d.score * d.weight) / 100, 0);
  const score = Math.round(total);

  const followUpQuestions = buildFollowUps(dims, prompt);
  const verdict: ValidationResult["verdict"] =
    score < hardBlock ? "blocked" : score < threshold ? "weak" : "ready";

  return { score, dimensions: dims, followUpQuestions, verdict };
}

function dim(name: string, weight: number, score: number, note: string): ValidationDimension {
  return { name, weight, score, note };
}

function buildFollowUps(dims: ValidationDimension[], prompt: string): string[] {
  const weak = dims.filter((d) => d.score < 55).sort((a, b) => a.score - b.score);
  const qs: string[] = [];
  for (const d of weak.slice(0, 3)) {
    switch (d.name) {
      case "Goal clarity":
        qs.push("What exactly do you want changed, and in what file or symbol?");
        break;
      case "Scope":
        qs.push("Which file(s) or function(s) should this touch? Anything that should *not* change?");
        break;
      case "Context":
        qs.push("Can you paste the relevant code, error message, or expected input/output?");
        break;
      case "Constraints":
        qs.push("What language/framework and any style or API constraints should be followed?");
        break;
      case "Acceptance":
        qs.push("How will we know it's done — a test that passes, or an expected output?");
        break;
      case "Ambiguity":
        qs.push(`You used vague references ("it"/"this"). Can you name the specific thing you mean?`);
        break;
    }
  }
  return qs;
}

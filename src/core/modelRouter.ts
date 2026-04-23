import { ModelSpec, RoutingResult, TaskType } from "./types.js";
import { MODEL_CATALOG } from "../data/pricing.js";

export interface RouteOptions {
  inputTokens: number;
  availableModels?: string[];   // if set, restrict to these ids
  preferCheap?: boolean;
  forceTier?: ModelSpec["tier"];
}

// Score each candidate model on (fit, cost, context). Higher = better.
export function route(task: TaskType, opts: RouteOptions): RoutingResult {
  const pool = (opts.availableModels && opts.availableModels.length
    ? MODEL_CATALOG.filter((m) => opts.availableModels!.includes(m.id))
    : MODEL_CATALOG
  ).filter((m) => m.contextWindow >= opts.inputTokens + 2_000);

  if (pool.length === 0) {
    // fall back to best context window available
    const byCtx = [...MODEL_CATALOG].sort((a, b) => b.contextWindow - a.contextWindow);
    return {
      model: byCtx[0],
      alternatives: byCtx.slice(1, 3),
      rationale: [`no model fits ${opts.inputTokens} input tokens; picking largest context (${byCtx[0].id})`],
    };
  }

  const scored = pool.map((m) => ({ m, s: scoreModel(m, task, opts) }));
  scored.sort((a, b) => b.s - a.s);

  const top = scored[0].m;
  const rationale = [
    `task=${task}`,
    `picked ${top.id} (tier=${top.tier}, fit=${top.strengths.includes(task) ? "yes" : "fallback"})`,
    `input≈${opts.inputTokens} tok, ctx=${top.contextWindow}`,
    opts.preferCheap ? "cheap-bias enabled" : "balanced bias",
  ];

  return {
    model: top,
    alternatives: scored.slice(1, 4).map((x) => x.m),
    rationale,
  };
}

function scoreModel(m: ModelSpec, task: TaskType, opts: RouteOptions): number {
  let s = 0;

  // Fit
  if (m.strengths.includes(task)) s += 50;
  else s += 10;

  // Tier match per task
  const tierPref = tierPreference(task);
  s += tierPref[m.tier] ?? 0;

  // Forced tier overrides
  if (opts.forceTier && m.tier === opts.forceTier) s += 40;
  if (opts.forceTier && m.tier !== opts.forceTier) s -= 20;

  // Cost bias
  const costPenalty = (m.pricePerMInput + m.pricePerMOutput) * (opts.preferCheap ? 2 : 0.5);
  s -= costPenalty;

  // Premium multiplier penalty (burns Copilot quota)
  s -= m.copilotPremiumMultiplier * (opts.preferCheap ? 6 : 2);

  // Context headroom bonus
  if (m.contextWindow >= opts.inputTokens * 4) s += 5;

  return s;
}

function tierPreference(task: TaskType): Partial<Record<ModelSpec["tier"], number>> {
  switch (task) {
    case "trivial":    return { cheap: 40, balanced: 15, premium: -10, reasoning: -15 };
    case "code_small": return { cheap: 25, balanced: 30, premium: 10,  reasoning: 5 };
    case "code_large": return { cheap: -10, balanced: 20, premium: 35, reasoning: 15 };
    case "reasoning":  return { cheap: -15, balanced: 10, premium: 25, reasoning: 40 };
    case "research":   return { cheap: 10, balanced: 30, premium: 20,  reasoning: 15 };
    case "creative":   return { cheap: 20, balanced: 30, premium: 15,  reasoning: -5 };
    case "agentic":    return { cheap: -5, balanced: 25, premium: 35,  reasoning: 10 };
  }
}

import { CostEstimate, ModelSpec, TaskType } from "./types.js";

export interface CostOptions {
  inputTokens: number;
  task: TaskType;
  /** If provided (e.g. from the LLM judge), overrides the task-ratio heuristic. */
  outputTokensOverride?: number;
}

// Task -> assumed output:input ratio. Reasoning tasks tend to produce
// long answers; trivial edits produce short ones.
const OUTPUT_RATIO: Record<TaskType, number> = {
  trivial: 0.2,
  code_small: 0.4,
  code_large: 0.8,
  reasoning: 1.5,
  research: 1.0,
  creative: 0.6,
  agentic: 0.8,
};

export function estimateCost(model: ModelSpec, opts: CostOptions): CostEstimate {
  const outTokens = opts.outputTokensOverride ??
    Math.ceil(opts.inputTokens * (OUTPUT_RATIO[opts.task] ?? 0.5));
  const inUsd  = (opts.inputTokens / 1_000_000) * model.pricePerMInput;
  const outUsd = (outTokens        / 1_000_000) * model.pricePerMOutput;
  const total = inUsd + outUsd;

  const humanReadable =
    `~${fmt(opts.inputTokens)} in / ~${fmt(outTokens)} out · ` +
    `~$${total.toFixed(total < 0.01 ? 4 : 3)} · ` +
    `${model.copilotPremiumMultiplier ? `${model.copilotPremiumMultiplier}× premium` : "base quota"} · ` +
    `model=${model.id}`;

  return {
    inputTokens: opts.inputTokens,
    outputTokensEstimate: outTokens,
    totalUsd: total,
    premiumRequests: model.copilotPremiumMultiplier,
    model: model.id,
    humanReadable,
  };
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

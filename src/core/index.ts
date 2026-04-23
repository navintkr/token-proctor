import { classify } from "./taskClassifier.js";
import { validate, ValidateOptions } from "./promptValidator.js";
import { route } from "./modelRouter.js";
import { estimateCost } from "./costEstimator.js";
import { estimateTokens } from "./tokens.js";
import { MODEL_CATALOG } from "../data/pricing.js";
import {
  ClassificationResult, CostEstimate, RoutingResult, ValidationResult,
} from "./types.js";

export interface AnalyzeInput {
  prompt: string;
  attachedText?: string;             // concatenated context (files, selection, etc.)
  availableModelIds?: string[];
  preferCheap?: boolean;
  completenessThreshold?: number;
}

export interface AnalyzeResult {
  classification: ClassificationResult;
  validation: ValidationResult;
  routing: RoutingResult;
  cost: CostEstimate;
  inputTokens: number;
}

export function analyze(input: AnalyzeInput): AnalyzeResult {
  const attached = input.attachedText ?? "";
  const fullText = input.prompt + "\n\n" + attached;
  const inputTokens = estimateTokens(fullText);

  const classification = classify(input.prompt, {
    attachedTokens: estimateTokens(attached),
    fileCount: attached ? Math.max(1, (attached.match(/^```/gm)?.length ?? 1)) : 0,
  });

  const validation = validate(input.prompt, {
    attachedChars: attached.length,
    threshold: input.completenessThreshold,
  } satisfies ValidateOptions);

  const routing = route(classification.task, {
    inputTokens,
    availableModels: input.availableModelIds,
    preferCheap: input.preferCheap,
  });

  const cost = estimateCost(routing.model, {
    inputTokens,
    task: classification.task,
  });

  return { classification, validation, routing, cost, inputTokens };
}

export { MODEL_CATALOG, classify, validate, route, estimateCost, estimateTokens };
export * from "./types.js";

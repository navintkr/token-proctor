import { ModelSpec } from "../core/types.js";

// Starter catalog. Prices are public list prices as of early 2026 and are
// meant to be overridden by org config. Update freely — this is just data.
// Copilot premium multipliers also drift; treat as directional.
export const MODEL_CATALOG: ModelSpec[] = [
  {
    id: "gpt-4o-mini",
    family: "openai",
    displayName: "GPT-4o mini",
    contextWindow: 128_000,
    pricePerMInput: 0.15,
    pricePerMOutput: 0.60,
    copilotPremiumMultiplier: 0,
    strengths: ["trivial", "code_small", "creative"],
    tier: "cheap",
  },
  {
    id: "gpt-4o",
    family: "openai",
    displayName: "GPT-4o",
    contextWindow: 128_000,
    pricePerMInput: 2.5,
    pricePerMOutput: 10.0,
    copilotPremiumMultiplier: 1,
    strengths: ["code_small", "code_large", "research", "creative", "agentic"],
    tier: "balanced",
  },
  {
    id: "o4-mini",
    family: "openai",
    displayName: "o4-mini (reasoning)",
    contextWindow: 200_000,
    pricePerMInput: 1.1,
    pricePerMOutput: 4.4,
    copilotPremiumMultiplier: 0.33,
    strengths: ["reasoning", "code_small"],
    tier: "reasoning",
  },
  {
    id: "claude-haiku",
    family: "anthropic",
    displayName: "Claude Haiku",
    contextWindow: 200_000,
    pricePerMInput: 0.25,
    pricePerMOutput: 1.25,
    copilotPremiumMultiplier: 0,
    strengths: ["trivial", "code_small", "creative"],
    tier: "cheap",
  },
  {
    id: "claude-sonnet-4",
    family: "anthropic",
    displayName: "Claude Sonnet 4",
    contextWindow: 200_000,
    pricePerMInput: 3.0,
    pricePerMOutput: 15.0,
    copilotPremiumMultiplier: 1,
    strengths: ["code_large", "agentic", "reasoning", "research"],
    tier: "premium",
  },
  {
    id: "claude-opus",
    family: "anthropic",
    displayName: "Claude Opus",
    contextWindow: 200_000,
    pricePerMInput: 15.0,
    pricePerMOutput: 75.0,
    copilotPremiumMultiplier: 10,
    strengths: ["reasoning", "code_large", "research"],
    tier: "premium",
  },
  {
    id: "gemini-flash",
    family: "google",
    displayName: "Gemini Flash",
    contextWindow: 1_000_000,
    pricePerMInput: 0.075,
    pricePerMOutput: 0.30,
    copilotPremiumMultiplier: 0,
    strengths: ["trivial", "code_small", "research"],
    tier: "cheap",
  },
];

export function findModel(id: string): ModelSpec | undefined {
  return MODEL_CATALOG.find(
    (m) => m.id === id || m.id.toLowerCase() === id.toLowerCase()
  );
}

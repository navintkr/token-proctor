// v0.2 — JSONL audit log.
// Opt-in. Writes one JSON line per decision to a local file. Never network.

import * as fs from "node:fs";
import * as path from "node:path";

export interface AuditEntry {
  ts: string;                          // ISO timestamp
  surface: "participant" | "mcp";
  command?: string;
  task: string;
  confidence: number;
  completeness: number;
  verdict: string;
  modelChosen: string;
  alternatives: string[];
  inputTokens: number;
  outputTokensEstimate: number;
  totalUsd: number;
  premiumRequests: number;
  redactions: { kind: string; count: number }[];
  policySource: string;
  blocked?: boolean;
  notes?: string[];
}

export function writeAuditEntry(filePath: string, entry: AuditEntry): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // intentionally swallow — audit must never break the primary path
  }
}

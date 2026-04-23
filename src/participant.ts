import * as vscode from "vscode";
import { analyze, AnalyzeResult } from "./core/index.js";
import { MODEL_CATALOG } from "./data/pricing.js";

export function registerConductor(context: vscode.ExtensionContext) {
  const participant = vscode.chat.createChatParticipant(
    "copilot-conductor.conductor",
    handler
  );
  participant.iconPath = new vscode.ThemeIcon("rocket");
  context.subscriptions.push(participant);
}

async function handler(
  request: vscode.ChatRequest,
  chatContext: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
  const cfg = vscode.workspace.getConfiguration("copilotConductor");
  const threshold = cfg.get<number>("completenessThreshold", 60);
  const autoForward = cfg.get<boolean>("autoForward", true);
  const preferCheap = cfg.get<boolean>("preferCheap", false);

  // Gather available Copilot models for this user (so we only route to what works).
  let availableIds: string[] | undefined;
  try {
    const models = await vscode.lm.selectChatModels();
    availableIds = models.map((m) => m.id).concat(models.map((m) => m.family));
  } catch {
    availableIds = undefined;
  }

  const attached = collectAttachedText(request, chatContext);
  const result = analyze({
    prompt: request.prompt,
    attachedText: attached,
    preferCheap,
    completenessThreshold: threshold,
    // We don't restrict by availableIds by default; our catalog id names may
    // not match Copilot's exact ids. Users can tighten this in config.
  });

  const cmd = request.command ?? "route";

  renderSummary(stream, result);

  if (cmd === "validate") {
    renderValidation(stream, result);
    return { metadata: { command: cmd } };
  }

  if (cmd === "cost") {
    renderCost(stream, result);
    return { metadata: { command: cmd } };
  }

  if (cmd === "explain") {
    renderExplain(stream, result);
    return { metadata: { command: cmd } };
  }

  // Default: route (+ optionally forward)
  renderRouting(stream, result);

  if (result.validation.verdict !== "ready") {
    renderFollowUps(stream, result);
    return { metadata: { command: cmd, blocked: true } };
  }

  if (autoForward) {
    stream.markdown("\n\n---\n*Forwarding to chosen model…*\n\n");
    await forward(request.prompt, result, stream, token);
  } else {
    stream.markdown(
      "\n\n_`copilotConductor.autoForward` is off — use your normal chat model to run the prompt._"
    );
  }

  return { metadata: { command: cmd } };
}

// ---------- forwarding ----------

async function forward(
  prompt: string,
  result: AnalyzeResult,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
) {
  // Try to select a model whose family or id loosely matches our pick.
  const want = result.routing.model;
  let models: vscode.LanguageModelChat[] = [];
  try {
    models = await vscode.lm.selectChatModels({ family: want.family });
  } catch {
    /* ignore */
  }
  if (models.length === 0) {
    try { models = await vscode.lm.selectChatModels(); } catch { /* ignore */ }
  }
  if (models.length === 0) {
    stream.markdown("> ⚠️ No language models available via `vscode.lm`. Install/sign in to GitHub Copilot.");
    return;
  }
  const model = models[0];
  stream.markdown(`> Using \`${model.id}\` (closest available to recommended \`${want.id}\`).\n\n`);

  try {
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const resp = await model.sendRequest(messages, {}, token);
    
    // Properly handle the response stream
    if (!resp) {
      stream.markdown(`\n\n> ❌ Model call failed: No response received`);
      return;
    }

    // Check if resp.text exists and is iterable
    if (resp.text) {
      try {
        for await (const chunk of resp.text) {
          stream.markdown(chunk);
        }
      } catch (streamErr: any) {
        stream.markdown(`\n\n> ❌ Failed to stream response: \`${streamErr?.message ?? streamErr}\``);
      }
    } else {
      stream.markdown(`\n\n> ❌ Model returned empty response`);
    }
  } catch (err: any) {
    stream.markdown(`\n\n> ❌ Model call failed: \`${err?.message ?? JSON.stringify(err)}\``);
  }
}

// ---------- rendering ----------

function renderSummary(stream: vscode.ChatResponseStream, r: AnalyzeResult) {
  const v = r.validation;
  const verdictIcon = v.verdict === "ready" ? "✅" : v.verdict === "weak" ? "⚠️" : "⛔";
  stream.markdown(
    `**Task:** \`${r.classification.task}\` (confidence ${(r.classification.confidence * 100).toFixed(0)}%)  \n` +
    `**Completeness:** ${verdictIcon} ${v.score}/100 (${v.verdict})  \n` +
    `**Recommended model:** \`${r.routing.model.id}\`  \n` +
    `**Estimate:** ${r.cost.humanReadable}\n`
  );
}

function renderValidation(stream: vscode.ChatResponseStream, r: AnalyzeResult) {
  stream.markdown("\n### Prompt completeness\n\n");
  stream.markdown("| Dimension | Weight | Score | Note |\n|---|---:|---:|---|\n");
  for (const d of r.validation.dimensions) {
    stream.markdown(`| ${d.name} | ${d.weight} | ${d.score} | ${d.note} |\n`);
  }
  if (r.validation.followUpQuestions.length) {
    stream.markdown("\n**Suggested follow‑ups:**\n");
    for (const q of r.validation.followUpQuestions) stream.markdown(`- ${q}\n`);
  }
}

function renderRouting(stream: vscode.ChatResponseStream, r: AnalyzeResult) {
  stream.markdown("\n### Routing\n\n");
  stream.markdown(r.routing.rationale.map((x) => `- ${x}`).join("\n") + "\n");
  if (r.routing.alternatives.length) {
    stream.markdown("\n**Alternatives:** " +
      r.routing.alternatives.map((m) => `\`${m.id}\``).join(", ") + "\n");
  }
}

function renderCost(stream: vscode.ChatResponseStream, r: AnalyzeResult) {
  stream.markdown("\n### Cost estimate\n\n");
  stream.markdown(
    `- Input tokens: **${r.cost.inputTokens.toLocaleString()}**\n` +
    `- Est. output tokens: **${r.cost.outputTokensEstimate.toLocaleString()}**\n` +
    `- Est. USD: **$${r.cost.totalUsd.toFixed(4)}**\n` +
    `- Premium requests: **${r.cost.premiumRequests}**\n` +
    `- Model: \`${r.cost.model}\`\n`
  );
  stream.markdown(
    "\n_Prices are list prices in [`src/data/pricing.ts`](command:copilot-conductor.openPricing); " +
    "override in your fork for real org rates._\n"
  );
}

function renderExplain(stream: vscode.ChatResponseStream, r: AnalyzeResult) {
  renderValidation(stream, r);
  renderRouting(stream, r);
  renderCost(stream, r);
  stream.markdown("\n### Candidate models considered\n\n");
  stream.markdown("| Model | Tier | Ctx | $/M in | $/M out | Premium× |\n|---|---|---:|---:|---:|---:|\n");
  for (const m of MODEL_CATALOG) {
    stream.markdown(`| \`${m.id}\` | ${m.tier} | ${m.contextWindow.toLocaleString()} | ${m.pricePerMInput} | ${m.pricePerMOutput} | ${m.copilotPremiumMultiplier} |\n`);
  }
}

function renderFollowUps(stream: vscode.ChatResponseStream, r: AnalyzeResult) {
  stream.markdown("\n> Prompt is **" + r.validation.verdict + "** — answering these first will save a premium request:\n\n");
  for (const q of r.validation.followUpQuestions) stream.markdown(`- ${q}\n`);
}

// ---------- attached context ----------

function collectAttachedText(
  request: vscode.ChatRequest,
  _ctx: vscode.ChatContext
): string {
  const parts: string[] = [];
  for (const ref of request.references ?? []) {
    try {
      const v = (ref as any).value;
      if (typeof v === "string") {
        parts.push(v);
      } else if (v && typeof v === "object") {
        // Location / Uri / Range — best-effort stringify
        if ("uri" in v && v.uri?.fsPath) parts.push(`file: ${v.uri.fsPath}`);
      }
    } catch { /* ignore */ }
  }
  return parts.join("\n");
}

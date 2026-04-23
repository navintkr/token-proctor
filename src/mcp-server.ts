#!/usr/bin/env node
// MCP server — exposes Conductor's core as tools over stdio.
// Works with Copilot agent mode, Copilot CLI, Claude Desktop, Cursor, etc.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  analyze, classify, validate, estimateTokens, estimateCost, MODEL_CATALOG,
} from "./core/index.js";
import { route } from "./core/modelRouter.js";
import { findModel } from "./data/pricing.js";

const server = new Server(
  { name: "copilot-conductor", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: "analyze_prompt",
    description:
      "Run the full Conductor pipeline on a prompt: classify, validate, route, cost. Returns a JSON report.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        attachedText: { type: "string", description: "Concatenated attached context (optional)" },
        preferCheap: { type: "boolean" },
        completenessThreshold: { type: "number" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "validate_prompt",
    description: "Score a prompt's completeness 0-100 and return follow-up questions if weak.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        attachedChars: { type: "number" },
        threshold: { type: "number" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "recommend_model",
    description: "Recommend the best model for a given prompt. Returns model id, alternatives, rationale.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        attachedText: { type: "string" },
        preferCheap: { type: "boolean" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "estimate_cost",
    description: "Estimate tokens and USD cost for a prompt against a named model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        attachedText: { type: "string" },
        modelId: { type: "string", description: "One of the catalog ids; omit to auto-route" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "list_models",
    description: "List the model catalog with prices and premium multipliers.",
    inputSchema: { type: "object", properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    switch (name) {
      case "analyze_prompt": {
        const r = analyze({
          prompt: String(args.prompt),
          attachedText: args.attachedText ? String(args.attachedText) : undefined,
          preferCheap: !!args.preferCheap,
          completenessThreshold: typeof args.completenessThreshold === "number"
            ? args.completenessThreshold : undefined,
        });
        return json(r);
      }

      case "validate_prompt": {
        const r = validate(String(args.prompt), {
          attachedChars: typeof args.attachedChars === "number" ? args.attachedChars : 0,
          threshold: typeof args.threshold === "number" ? args.threshold : undefined,
        });
        return json(r);
      }

      case "recommend_model": {
        const prompt = String(args.prompt);
        const attached = args.attachedText ? String(args.attachedText) : "";
        const cls = classify(prompt, { attachedTokens: estimateTokens(attached) });
        const r = route(cls.task, {
          inputTokens: estimateTokens(prompt + "\n" + attached),
          preferCheap: !!args.preferCheap,
        });
        return json({ classification: cls, routing: r });
      }

      case "estimate_cost": {
        const prompt = String(args.prompt);
        const attached = args.attachedText ? String(args.attachedText) : "";
        const inputTokens = estimateTokens(prompt + "\n" + attached);
        const cls = classify(prompt);
        const model = args.modelId
          ? findModel(String(args.modelId))
          : route(cls.task, { inputTokens }).model;
        if (!model) return text(`Unknown model: ${args.modelId}`);
        const c = estimateCost(model, { inputTokens, task: cls.task });
        return json(c);
      }

      case "list_models":
        return json(MODEL_CATALOG);

      default:
        return text(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return text(`Error: ${err?.message ?? err}`);
  }
});

function json(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}
function text(t: string) {
  return { content: [{ type: "text", text: t }] };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr log so MCP clients don't see it on stdout
  console.error("copilot-conductor MCP server ready");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

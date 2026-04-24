# Seeded Issues

Copy-paste each block into a new GitHub issue at
https://github.com/navintkr/token-proctor/issues/new

Set the listed labels (create them in Issues → Labels if missing).
Pin issue #1 and #5 to the repo.

---

## Issue 1 — Add Gemini 2.0 / 2.5 pricing to the model catalog

**Title:** `Add Gemini 2.0 Flash and 2.5 Pro pricing to the model catalog`

**Labels:** `good first issue`, `enhancement`, `pricing`

**Body:**

```markdown
The router can only recommend models that exist in
[`src/data/pricing.ts`](src/data/pricing.ts). The current catalog has
`gemini-flash` but is missing Gemini 2.0 Flash, 2.0 Flash-Lite, and
2.5 Pro, which are the variants most teams actually have access to
via `vscode.lm` today.

### What to do

1. Open [`src/data/pricing.ts`](src/data/pricing.ts).
2. Look at the existing entries — each model is an object with
   `id`, `tier`, `inputPricePerM`, `outputPricePerM`,
   `premiumMultiplier`, `contextWindow`, and `goodAt` tags.
3. Add entries for:
   - `gemini-2.0-flash` (cheap tier, 0× premium)
   - `gemini-2.0-flash-lite` (cheap tier, 0× premium)
   - `gemini-2.5-pro` (reasoning tier, check Google's current multiplier)
4. Pull current prices from https://ai.google.dev/pricing — use the
   paid-tier numbers, not the free-tier ones.
5. Make sure the id matches the exact string `vscode.lm.selectChatModels`
   returns for that family (check by running the chat participant
   against a workspace that has Gemini enabled).

### Acceptance

- [ ] New entries present in `MODEL_CATALOG`.
- [ ] `@proctor /explain gemini-friendly prompt` lists them in the
      candidate matrix.
- [ ] README model list updated if you count from it.

### Why this matters

Without these entries, the router will never recommend them even
when Gemini is the cheapest model available, silently pushing users
toward OpenAI or Anthropic by default.
```

---

## Issue 2 — Add Azure OpenAI deployment-name routing

**Title:** `Support Azure OpenAI deployment-name resolution in the router`

**Labels:** `good first issue`, `enhancement`, `azure`

**Body:**

```markdown
Azure OpenAI doesn't surface the underlying model id through
`vscode.lm` — it surfaces a *deployment name* chosen by whoever
provisioned the resource (e.g. `gpt-4o-prod`, `my-team-mini`). Right
now Token Proctor's router only matches on canonical ids, so Azure
users see their deployments as "unknown" and get routed to whatever
non-Azure model is available.

### What to do

1. Add an optional `azureDeployments` section to `.token-proctor.json`
   that maps deployment name → canonical model id, e.g.:
   ```json
   {
     "azureDeployments": {
       "gpt-4o-prod": "gpt-4o",
       "my-team-mini": "gpt-4o-mini"
     }
   }
   ```
2. Update [`src/core/policy.ts`](src/core/policy.ts) to parse the new
   field.
3. In [`src/core/modelRouter.ts`](src/core/modelRouter.ts), when
   resolving a model id that isn't in the catalog, check the deployment
   map before marking it unknown.
4. Document it in the README policy block.

### Acceptance

- [ ] New config field parsed without breaking existing policies.
- [ ] A deployment name like `my-team-mini` gets costed as
      `gpt-4o-mini` in the estimate.
- [ ] Unit test covering a policy with two deployments.

### Why this matters

Teams on Azure-hosted Copilot / Foundry are exactly the audience that
cares most about cost visibility — and today they get the worst
experience.
```

---

## Issue 3 — Auto-detect Copilot agent mode and bias `optimizeFor` to `turns`

**Title:** `Detect Copilot agent mode at chat time and default optimizeFor to "turns"`

**Labels:** `help wanted`, `enhancement`, `router`

**Body:**

```markdown
The `optimizeFor` knob (`tokens` | `turns` | `balanced`) is exactly
the right trade-off for Copilot agent mode vs one-shot chat. But
right now the user has to set it manually in settings or policy.
We should detect agent-mode-like signals at request time and flip
to `turns` automatically (with a way to opt out).

### Possible signals

- Presence of tools in the `ChatRequest.toolReferences` array (agent
  mode passes tools; ask-mode doesn't).
- Prompt keywords that strongly suggest multi-step work:
  "refactor across", "migrate", "implement ... and write tests",
  "investigate why", "walk the codebase".
- The task classifier already returns `code_large` / `agentic` —
  treat those as an auto-bias to `turns` regardless of user setting.

### What to do

1. In [`src/participant.ts`](src/participant.ts), inspect
   `request.toolReferences` on each turn; record whether any tools
   were attached.
2. In [`src/core/index.ts`](src/core/index.ts) `analyzeAsync`, if
   `optimizeFor` came in as `"auto"` (new value, default?), resolve
   to `"turns"` when (a) tools are attached, (b) task is
   `code_large` or `agentic`, (c) judge turns estimate > 5.
   Otherwise resolve to `"tokens"`.
3. Surface the chosen mode in the footer (e.g. `opt=turns (auto: tools)`).
4. Add a setting `tokenProctor.optimizeFor` default `"auto"` and
   document the resolution rules.

### Acceptance

- [ ] New `"auto"` option in the settings enum + README.
- [ ] Agentic prompts (or prompts with tools) resolve to `turns`.
- [ ] Q&A prompts resolve to `tokens`.
- [ ] Footer shows why the mode was chosen.

### Why this matters

The #1 failure mode today is a user who installs Token Proctor and
never touches settings — they get the `tokens` default, which is
actively wrong for their 20-turn agent loops. This fixes the
default-on experience.
```

---

## Issue 4 — Export audit JSONL to CSV + Grafana-friendly format

**Title:** `Export .token-proctor/audit.jsonl to CSV and a Grafana-ready metrics format`

**Labels:** `enhancement`, `observability`

**Body:**

```markdown
The JSONL audit log captures every routing decision (task, model,
cost, redactions, verdict) but it's only useful if someone opens it.
Teams want to push this into Grafana, a spreadsheet, or their finops
dashboard.

### What to do

Option A (simplest, ship first): a new CLI subcommand
`token-proctor-mcp --export-csv <out>` that reads the JSONL file and
emits a CSV with columns:
`timestamp,user,task,model,tier,inputTokens,outputTokens,turns,costUsd,planBurnPct,redactions,verdict`.

Option B (nice to have): emit OpenTelemetry spans or Prometheus
gauges so the audit log can feed a real dashboard. Start simple;
this can be a follow-up issue.

### Acceptance

- [ ] `node out/mcp-server.js --export-csv out.csv` produces a valid
      CSV from the current `.token-proctor/audit.jsonl`.
- [ ] README "Observability" section.
- [ ] Ships without adding new dependencies (Node's `fs` + string
      joining is enough).

### Why this matters

This is the feature team leads ask for after two weeks of use:
"cool, but how do I show my manager we saved money?" Without an
export path, the audit log is write-only.
```

---

## Issue 5 — Roadmap: v0.5 `vscode.lm.registerTool` integration (PINNED DISCUSSION)

**Title:** `Roadmap: make Token Proctor callable from Copilot agent mode via vscode.lm.registerTool`

**Labels:** `discussion`, `roadmap`, `help wanted`

> **Convert this issue to a GitHub Discussion** (the button is on the
> sidebar when viewing the issue) and pin it. Discussions show up on
> the repo home and invite participation in a way issues don't.

**Body:**

```markdown
Today Token Proctor runs as a chat participant: the user types
`@proctor …`, we analyze, we hand off to Copilot. That's one seam
before Copilot's agent loop starts. It misses the bigger win —
letting Copilot's agent consult Token Proctor *during* its own loop
to ask "is this next sub-prompt vague?" or "is the model I'm about
to call the right one for this step?"

VS Code exposes `vscode.lm.registerTool` for exactly this pattern:
any extension can register a tool and Copilot agent mode will pick
it up automatically.

### The shape I'm imagining

Two tools, thin adapters over the existing core:

- `proctor_validate(prompt: string) → { score, followUps }`
- `proctor_route(prompt: string, context?: string) →
   { task, recommendedModel, turnsEstimate, cost }`

### Open questions

1. **Gating.** Should these tools be on by default or opt-in?
   Copilot runs tools aggressively; we don't want to drown the
   agent in validation noise.
2. **Feedback loop.** If the router says "this is wrong for a 0×
   model, switch to reasoning", Copilot has no way to actually
   switch its own model mid-turn. Do we just surface the warning,
   or do we request tool-approval for a model swap?
3. **Telemetry.** A tool call is a natural place to log the audit
   entry with actual outcome (did the agent take our advice?).
4. **Handling streaming.** Tools return blocks; how do we preserve
   the nice markdown summary the chat participant produces?

### What I'm looking for in this discussion

- Use cases you'd want from an in-agent-loop validator/router
- Opinions on default-on vs opt-in
- Pointers to other extensions that have done this well
- Willingness to prototype (I'll happily pair on it)

No deadline — this is the v0.5 conversation. When we have a design
we agree on, I'll open implementation issues.
```

---

## After opening the issues

1. Pin issues #1 and #5 (Discussions → Pin, or Issues → ••• → Pin).
2. Create the labels if they don't exist: `good first issue`,
   `help wanted`, `enhancement`, `discussion`, `pricing`, `azure`,
   `router`, `observability`, `roadmap`.
3. Add a link to `CONTRIBUTING.md` in each "Acceptance" section
   (write one if missing — even a 20-line stub works:
   clone, `npm install`, `npm run compile`, `F5`, run tests).
4. In the repo About panel, toggle on "Use your GitHub Discussions
   for questions and roadmap conversations".

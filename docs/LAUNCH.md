# Launch Kit

Assets for driving visibility to the Token Proctor repo and Marketplace listing.
Pick one channel per day, not all in one go.

---

## 1. GitHub repo metadata

### Description (paste into GitHub → About → Edit)

> VS Code extension + MCP server that validates prompts, routes to the cheapest LLM, and projects token × turn cost before the call. Cuts Copilot premium-request burn on agent loops.

### Topics (paste one-by-one into GitHub → About → Topics)

```
copilot
github-copilot
vscode-extension
vscode-chat-participant
mcp
model-context-protocol
llm
llm-tools
llm-cost
token-counting
tiktoken
prompt-engineering
prompt-validation
model-routing
cost-optimization
agent
ai-agents
```

### Pinned README badges (add under the title)

```markdown
[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/token-proctor.token-proctor?label=VS%20Marketplace&color=blueviolet)](https://marketplace.visualstudio.com/items?itemName=token-proctor.token-proctor)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/token-proctor.token-proctor)](https://marketplace.visualstudio.com/items?itemName=token-proctor.token-proctor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/navintkr/token-proctor?style=social)](https://github.com/navintkr/token-proctor)
```

---

## 2. Show HN post

**Submit at:** https://news.ycombinator.com/submit — Tue/Wed/Thu, 8–10 AM US Eastern.
**URL field:** `https://github.com/navintkr/token-proctor`
**Leave the text field blank for a Show HN** (HN convention — the URL is the content). Then immediately add the first comment below.

### Title (80 char limit)

```
Show HN: Token Proctor – project Copilot token × turn cost before the call
```

### First comment (post yourself right after submission)

```
Author here. Built this after watching my team burn ~70% of our Copilot
premium-request budget on agent loops that ran a 1× multiplier model
(Sonnet) for 20+ turns on jobs that o4-mini would have finished in 6.

The trick that wasn't in any existing router: LLM judges can estimate
not just the task type but roughly how many agent turns a prompt will
need. Once you have turns × output-token estimate, you can actually
cost an agentic prompt before dispatching it, instead of after the bill.

Three things it does, all local, no proxy:
- scores prompt completeness 0–100 and asks follow-ups if vague
- classifies (Q&A / code_small / code_large / reasoning / agentic) and
  routes to the cheapest model that clears the quality bar
- projects tokens × turns × $ and shows % of your monthly plan burn

An `optimizeFor` knob lets you pick tokens (cheapest $/M) vs turns
(minimize premium × turns, which is what matters for agent mode) vs
balanced. Default is tokens.

Ships as a VS Code chat participant (`@proctor`) and as an MCP server,
so Copilot CLI / Claude Desktop / Cursor can call the same core.

Happy to answer questions on the classifier, the routing math, or
why Marketplace extensions can't actually flip the Copilot model
dropdown today (spoiler: there's no API for it).
```

### Tips

- Don't upvote your own submission or ask others to. HN detects rings and kills threads.
- Stay in the comments for the first 3 hours. Response rate inside that window is what decides front page.
- If you get downvoted to hell, don't delete — rewrite and try again in a month with a different angle.

---

## 3. Dev.to / Hashnode article

Cross-post the same markdown to both. Dev.to tags: `#copilot #llm #vscode #ai`.

### Title

**Why your Copilot agent costs 20× more than a single call — and what to do about it**

### Subtitle

*A look at turn-aware cost routing, and a small open-source tool that does it for you.*

### Body

```markdown
Every Copilot Business team I've worked with hits the same wall around
month four: the premium-request bill is 5–10× what the pilot suggested.
The usual diagnosis ("users are lazy and pick GPT-5 for everything") is
only half the story. The other half is agent mode.

## The math nobody runs

Pick a prompt. "Refactor this service to use async I/O everywhere."

- **Single-call cost:** ~800 input + 1200 output tokens, one model call.
- **Agent-mode cost:** 20+ turns of read-file, apply-edit, run-tests,
  re-read, re-edit. Each turn ships the growing context back in.

If each turn is a 1× premium model (Sonnet 4, GPT-5), that's 20 premium
requests for one prompt. On a 300-request monthly plan, three agentic
prompts blow through 20% of the budget.

Now swap to o4-mini (0.33× multiplier). Same 20 turns become ~6.6
premium-equivalent requests. 70% cheaper for the same job — assuming
the smaller model can actually handle it, which for "code_large but
not reasoning-heavy" tasks is almost always yes.

## The missing signal

Every prompt router I've seen optimizes one dimension: $/M input
tokens. That's right for Q&A. It's wrong for agent mode, where
**premium multiplier × turn count** dominates input pricing by an order
of magnitude.

To route correctly you need two estimates up front:
1. How many turns will this prompt take?
2. How many output tokens per turn?

Rule-based heuristics give you (2) passably. For (1) you need an LLM
to look at the prompt and guess — "this is a one-shot answer" vs
"this will poke around a 10-file codebase for a while."

## Token Proctor

I open-sourced the thing I built for this:
https://github.com/navintkr/token-proctor

It's a VS Code chat participant (`@proctor`) plus an MCP server. The
pipeline:

1. **Redact secrets** (AWS, GitHub, Stripe, JWT, PEM, etc.) before
   anything leaves the pure-function core.
2. **Validate completeness** — score 0–100 across five weighted
   dimensions; ask follow-ups if the prompt is vague.
3. **Classify** the task with rules + (if confidence < 0.85) a cheap
   `vscode.lm` LLM judge that also returns `outputTokens` and `turns`
   estimates.
4. **Route** with an `optimizeFor` knob:
   - `tokens` — classic $/M optimization (default)
   - `turns`  — minimize `premium × turns` (the right choice for
                agent mode)
   - `balanced` — both
5. **Project cost** — `inputTokens × outputTokens × turns × model` plus
   % of your monthly plan allowance if you configure `plan` in policy.
6. **Confirm + hand off** to Copilot's agent with the redacted prompt.

Sample output on a code_small prompt:

    Task: code_small (confidence 90%)
    Completeness: ✅ 72/100 (ready)
    Recommended model: gpt-4o-mini
    Estimate: ~210 in / ~180 out × 2 turns · ~$0.0005 · base quota ·
             model=gpt-4o-mini · plan=squad 0.01%

## What's actually novel

Three things I hadn't seen combined elsewhere:

- **Turn estimation from the judge LLM.** One cheap call, two useful
  numbers. Costs fractions of a cent and changes the whole routing
  calculus for agentic work.
- **Plan-aware burn %.** You see "this prompt = 4.5% of your squad
  monthly tokens" in the summary. Makes premium decisions tangible.
- **Same core, two surfaces.** VS Code chat participant and MCP server
  are thin adapters over a pure-function core. The core has no I/O,
  which makes it trivial to unit test or embed in CI linting.

## What it can't do (yet)

VS Code exposes no public API to flip Copilot's chat-model dropdown.
The hand-off command probes seven candidate command IDs and falls back
to a toast asking you to pick manually. If someone from the Copilot
team is reading this: give us `github.copilot.chat.setModel(string)`
and every router in the ecosystem gets a huge upgrade.

## Try it

    code --install-extension token-proctor.token-proctor

…or the `.vsix` from GitHub releases. Config lives in
`.token-proctor.json` at the repo root. MIT licensed.

Not selling anything. If your team has a good pattern for Copilot
budget discipline I'd love to steal it.
```

---

## 4. Short posts

### X / Twitter thread (5 tweets)

```
1/ Your Copilot agent is not one request. It's 20.

On a 1× premium model (Sonnet, GPT-5) that's 20 premium requests per
prompt. Teams blow through the monthly bucket in a week and have no
idea why.

2/ The fix is a routing signal nobody surfaces: turns.

An LLM judge, called once with a cheap mini model, can tell you:
- task type (agentic vs code_small vs Q&A)
- rough output tokens per turn
- rough number of turns

3/ With those three numbers you can pick the model that minimizes
   premium × turns, not $/M. For agent mode that's almost always a
   0.33× reasoning-mini over a 1× flagship — same job, 70% cheaper.

4/ Built Token Proctor to do exactly that. VS Code chat participant
   + MCP server. Validates your prompt, routes, and shows the real
   cost (tokens × turns × $ + % of your monthly plan) before the call.

5/ 100% local, no proxy, MIT licensed.
   https://github.com/navintkr/token-proctor
```

### LinkedIn post

```
Most "Copilot is expensive" conversations I've had this year miss the
same point: Copilot agent mode isn't one premium request, it's 20.

One prompt → 20 turns of read-file / edit / test / re-read. Each turn
ships the growing context back in, and each turn is billed at the
chat model's premium multiplier. On a 1× model (Sonnet 4, GPT-5)
that's 20 premium requests for one user prompt. Three of those and
you've eaten 20% of a monthly seat budget.

The lever is routing, but not on $/M tokens — on premium × turns.
A 0.33× reasoning-mini doing 20 turns burns ~6.6 requests. Same job,
70% cheaper, quality degradation for code_large-but-not-novel work
is basically nil.

Open-sourced the router we've been using:
https://github.com/navintkr/token-proctor

Validates the prompt, estimates turns via a cheap LLM judge, routes
to the cheapest model that clears the quality bar, shows % of your
monthly plan spent before you hit send. Ships as a VS Code chat
participant and an MCP server. MIT.

Curious what other teams are doing here — drop a comment if you've
got a pattern that works.
```

### r/vscode post (keep it humble)

**Title:** `Built a VS Code chat participant that projects Copilot agent cost before the call — open source`

**Body:**

```
Hey r/vscode — sharing a small tool I've been using and cleaning up
in the open. Token Proctor is a `@proctor` chat participant that:

- scores your prompt 0–100 for completeness and asks follow-ups if
  it's too vague
- classifies the task and routes to the cheapest model that clears
  the bar (with a tokens-vs-turns knob for agent loops)
- projects tokens × turns × $ and % of your monthly plan before the
  call, then hands off to Copilot to actually run it

Same core also ships as an MCP server so Copilot CLI / Claude
Desktop / Cursor can use it.

100% local, no proxy, MIT. Would love feedback, especially from
anyone who's been fighting the agent-mode bill.

https://github.com/navintkr/token-proctor
```

---

## 5. Seeded GitHub issues (open these yourself)

Creates the look of an active project and real first-timer paths.

1. **`good first issue`**: *Add Gemini 2.0 and Gemini 2.5 pricing to the model catalog* — point at `src/data/pricing.ts`, explain the schema, list what's missing.
2. **`good first issue`**: *Add Azure OpenAI deployment-name support to the router* — describe the naming quirk.
3. **`help wanted`**: *Detect Copilot agent mode automatically and set `optimizeFor` to `turns`* — describe the signal (presence of agent tool calls in context).
4. **`enhancement`**: *Export audit.jsonl to a CSV / Grafana dashboard* — the "I want this for my team lead" issue.
5. **`discussion`**: *Roadmap for v0.5: `vscode.lm.registerTool` support* — pin as a Discussion.

---

## 6. Awesome-list PRs

One-line entry format:

```markdown
- [Token Proctor](https://github.com/navintkr/token-proctor) — VS Code extension + MCP server that validates prompts, routes to the cheapest LLM, and projects token × turn cost before the call. Turn-aware routing for Copilot agent mode.
```

Targets:
- `awesome-copilot` (sindresorhus-style)
- `awesome-vscode`
- `awesome-llm`
- `awesome-mcp-servers`
- `awesome-ai-agents`

Submit as individual PRs with a one-paragraph rationale and a link
to your GitHub repo. Don't submit to lists you haven't actually used
— maintainers can tell.

---

## Order of operations (this week)

- **Day 0 (today):** GitHub description + topics + README badges. Push.
- **Day 1:** Record 30-sec demo GIF. Add to top of README. Push. Open 5 seeded issues.
- **Day 2:** Post to r/vscode and r/LocalLLaMA. Reply to every comment.
- **Day 3:** Publish Dev.to article. Post LinkedIn.
- **Day 4:** Show HN. Block out 3 hours to sit in the thread.
- **Day 5–7:** Awesome-list PRs.

Don't hit Show HN until the README is tight and the repo has at least
20 stars and the GIF at the top. One shot per project.

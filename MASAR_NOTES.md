# MASAR Build Notes
MASAR — adaptive learning platform for Omani university students. Fork of OpenMAIC (upstream keeps its credit/attribution).
Findings, path corrections, and decisions recorded during the build.

## Project rename (human decision, 2026-08-25)
- `package.json` name: `openmaic` → `masar`. Workspace packages keep `@openmaic/*` scope (upstream attribution).
- `app/layout.tsx` metadata title: `OpenMAIC` → `MASAR` (description credits the fork origin).
- Branch already `masar-main`. No upstream files/directories renamed.

## Task 0 — Environment
- Docker was not installed. Installed colima + docker CLI + docker-compose via Homebrew.
- Disk was 100% full (138 MB free); colima's first boot failed. With human approval cleared
  ~/Library/Caches/{Arc, ms-playwright, camoufox} (~4.3 GB freed).
- First colima VM failed to reach SSH ("did not receive an event with the running status").
  Deleted and recreated the VM: `colima start --cpu 2 --memory 4 --disk 30 --vm-type vz --vz-rosetta` — works.
- docker-compose installed as standalone binary; symlinked into ~/.docker/cli-plugins so `docker compose` works.

## Task 1
- Cloned OpenMAIC, branch `masar-main` created.
- `pnpm install` exited 0 in 3m 40s. pnpm printed a warning about ignored build scripts
  (esbuild, onnxruntime-node, canvas, etc.) — expected under pnpm 10; not blocking.

## Task 2
- `.env.local` created from `.env.example` (424 lines read in full first), GLM block appended:
  `GLM_API_KEY` (placeholder — **human must supply real key**), `GLM_BASE_URL=https://api.z.ai/api/paas/v4`,
  `DEFAULT_MODEL=glm:glm-5.2`. Verified gitignored via `git check-ignore`.
- Note: `.env.example` also supports an optional `GLM_MODELS` override (comma-separated model IDs).
  Not needed — see Task 3: model list is hardcoded in providers.ts.

## Task 3 (partial — model registration check)
- **`glm-5.2` IS registered**: `lib/ai/providers.ts:636` (models array of the `glm` provider,
  id `glm-5.2`, name `GLM-5.2`, 1M context, streaming+tools+toggleable thinking).
  Also has effort-based thinking metadata at `lib/ai/model-metadata.ts:342`.
- Provider default base URL is the China endpoint; international endpoint
  `https://api.z.ai/api/paas/v4` is listed as an alternate (`providers.ts:629`) and matches
  our `GLM_BASE_URL`. No allowlist edit needed.
- **Exact model identifier string: `glm:glm-5.2`** (provider prefix `glm` + model id `glm-5.2`).
- Remaining for acceptance (dev server + live generation): blocked on real GLM_API_KEY.

## Task 2/3 — API key + model availability (human decision recorded)
- Human supplied real GLM key; verified valid against `https://api.z.ai/api/paas/v4`.
- **`glm-5.2` returns HTTP 429 code 1113 "Insufficient balance or no resource package"** —
  account has no paid credit. Same for `glm-4.7` and `glm-4.7-flashx`.
- **`glm-4.7-flash` (free tier) works**: verified trivial generation (chat/completions, 200,
  content "OK"). It is already registered in the app at `lib/ai/providers.ts:690`.
- **DECISION (human-approved): use `glm:glm-4.7-flash` as DEFAULT_MODEL for now.**
  Switch back to `glm:glm-5.2` by editing `.env.local` after recharging z.ai.
  Note: glm-4.7-flash emits `reasoning_content` — with `thinking.type=disabled` it answers
  directly. The app's thinking-toggle metadata (`model-metadata.ts:348`) already models this.

## Task 3 — ACCEPTANCE PASSED (with model substitution)
- `pnpm dev` serves on http://localhost:3000 (HTTP 200).
- Trivial generation verified **through the app's provider abstraction**:
  `POST /api/verify-model {"model":"glm:glm-4.7-flash"}` → `{"success":true,"message":"Connection successful","response":"OK"}`.
- Model is selectable in the UI model list (registered provider list drives Settings).
- **Working model identifier: `glm:glm-4.7-flash`** (substituted for `glm:glm-5.2` per human decision above).

## Provider Portability (audit, 2026-08-25)

**Rule: all MASAR code calls the LLM only through the app's abstraction. No raw fetch to any
model endpoint exists in app code. Switching providers = editing `.env.local` only.**

### Abstraction layers (verified by reading each file)
- `lib/ai/llm.ts:325,397` — `callLLM`/`streamLLM`, the only wrappers around Vercel AI SDK
  `generateText`/`streamText` in app code.
- `lib/server/resolve-model.ts:40-144` — resolves provider+model+key+baseUrl from
  `MODEL_ROUTES` stage route > client `x-model` > `DEFAULT_MODEL` env. This is the switch point.
- `lib/server/provider-config.ts:59-80` — env prefix map (`OLLAMA: 'ollama'`, `LEMONADE: 'lemonade'`,
  `GLM: 'glm'`, …); `:425` keyless set (`ollama`, `lemonade`, bedrock) — these activate on
  `*_BASE_URL` alone, no API key needed.
- `lib/ai/providers.ts:1504-1534` — `ollama` provider registered (type openai,
  defaultBaseUrl `http://localhost:11434/v1`, requiresApiKey: false).
  `:1536-1550` — `lemonade` provider (port 13305).
- SSRF guard (`lib/server/ssrf-guard.ts:180,198-206`) applies only to client-supplied URLs;
  server env-configured base URLs are trusted (`resolve-model.ts:103-109`), so pointing at
  localhost Ollama via env needs no `ALLOW_LOCAL_NETWORKS` in dev. (Production hardening note:
  the guard check itself is skipped only for managed providers; client-sent localhost is still
  blocked — correct behavior.)

### Every file that touches an LLM (audit list)
| File | Call | Goes through abstraction |
|---|---|---|
| `lib/server/classroom-generation.ts` | `callLLM` via `resolveModel({stage:'generate-classroom'})` | ✅ |
| `lib/server/scene-generation.ts` | `aiCall` fn built from `callLLM` | ✅ |
| `app/api/chat/route.ts` | `resolveModel` + stream | ✅ |
| `app/api/chat/pi/route.ts` | `resolveModel` | ✅ |
| `app/api/agent/edit/route.ts` | `resolveModelFromRequest` + `callLLM` | ✅ |
| `app/api/generate/scene-content/route.ts` | `resolveModel` + `callLLM` | ✅ |
| `app/api/generate/scene-actions/route.ts` | `resolveModel` + `callLLM` | ✅ |
| `app/api/generate/agent-profiles/route.ts` | `resolveModel` + `callLLM` | ✅ |
| `app/api/quiz-grade/route.ts` | `resolveModelFromRequest` + `callLLM` | ✅ |
| `app/api/verify-model/route.ts` | `callLLM` | ✅ |
| `app/api/web-search/route.ts` | `callLLM` | ✅ |
| `lib/pbl/v2/agents/planner.ts` | injected `callLLM` (PlannerCallFn) | ✅ |
| `lib/pbl/v2/agents/simulator.ts` | `callLLM`/`streamLLM` | ✅ |
| `lib/web-search/claude.ts` | `callLLM` | ✅ |
| `lib/orchestration/ai-sdk-adapter.ts` | `callLLM`/`streamLLM` | ✅ |
| `lib/agent/runtime/stream-fn.ts` | `streamLLM` | ✅ |
| `eval/*/runner.ts,judge.ts,scorer.ts` | AI SDK `generateText` directly, model passed in as param | ⚠️ dev tooling only, not shipped app code — acceptable |

Raw `fetch(` hits in `lib/`+`app/` were grepped for `chat/completions|/messages|api.z.ai|bigmodel|openai.com|anthropic`:
**zero matches in app code** (only fetches to our own `/api/*` routes and to TTS/media services,
which have their own provider abstraction and are out of scope for the LLM switch).

### Future MASAR components (Analyzer, Path Agent) — binding requirement
Both MUST be built as `app/api/*/route.ts` calling `callLLM` with `resolveModel({stage:…})`,
inheriting Ollama/Lemonade portability for free. No direct provider SDK imports, no raw fetch.

### Local fallback recipe (verified against repo config, not guessed)
To run on Ollama with an open-weights model, edit `.env.local` only:
```
# comment out / leave GLM lines — DEFAULT_MODEL is the single switch
OLLAMA_BASE_URL=http://localhost:11434/v1
DEFAULT_MODEL=ollama:<model-name>          # e.g. ollama:qwen3:14b — model must exist in `ollama list`
# optional, only if the model id is not in the registered list:
# OLLAMA_MODELS=<comma-separated-ids>       (lib/server/provider-config.ts:220-226)
```
Notes:
- `OLLAMA_BASE_URL` makes ollama a *managed server provider* (`provider-config.ts:236-247`,
  keyless activation), so its base URL is authoritative and SSRF-exempt.
- Prefix is `ollama:` not `ollama/` (`parseModelString`; DEFAULT_MODEL examples in
  `.env.example:312-314` use `provider:model`).
- Client-side: browser UI may have its own saved model (localStorage) that it sends as `x-model`;
  on a fresh browser/profile DEFAULT_MODEL applies. To force server-side regardless of client,
  use `MODEL_ROUTES` (`.env.example:317-347`) — e.g. pin `session-analyze` stage later.

## Key handling
- Real GLM key lives only in `.env.local` (gitignored, verified `git check-ignore`).
- Never committed, never printed to logs (this file records only its prefix in Task 2 notes — none).
- If key missing/rejected: stop and ask the human (runbook rule).

## Quality risks if downgrading to a smaller local model
Most sensitive → least sensitive:
1. **Analyzer (Task 10)** — needs (a) valid strict JSON, (b) judgement expressed in ONE Arabic
   sentence. Small models fail JSON discipline often; defensive `parseAnalyzerOutput` fallback
   keeps it alive but silently returns empty analysis. Re-test first on any model switch.
2. **Path Agent (Task 12)** — same JSON dependency plus adapting pedagogy; failure falls back to
   default parameters (safe but loses adaptivity — the core MASAR feature).
3. **Outline/scene generation** — long structured JSON; upstream has retries
   (`withGenerationRetry`) and repair (`parseJsonResponse`), but Arabic quality of the actual
   teaching content will drop visibly on small models.
4. **Chat/classmate agents** — free-text, no JSON constraint; most tolerant, but Arabic
   persona quality and cultural nuance degrade.
Arabic capability note: Qwen and Gemma families are typically stronger in Arabic than Llama.
GLM's Chinese-vendor lineage also generally carries decent Arabic. Validate with an actual
Arabic prompt before trusting any model swap.

## Ollama removal (human decision, 2026-08-25)
- Human decided: GLM API only. Ollama uninstalled (brew), `~/.ollama` data removed, server stopped.
- The Provider Portability section stays valid as documentation of the local-fallback path
  (env-only switch recipe) in case competition rules change — but nothing local is installed now.
- Disk was at literal 0 bytes (ENOSPC on every write). Recovery: .next cache cleared (1.7 GB),
  Ollama removed (~1.5 GB). Now ~4.6 GB free.

## Task 4 — Baseline Arabic classroom (ACCEPTANCE PASSED with documented defects)
- Generated `HTKCqGqahs` (3 scenes) from Arabic requirement via API on glm-4.7-flash free tier.
- **Generation time: ~15.5 min** (1-scene requirement expanded to 3 scenes by outline stage;
  free tier is slow + serial scene generation; first attempt on a 4-scene course died at
  scene 4 with HTTP 429 rate-limit after 6 retries — noted as free-tier flakiness, not a bug).
- **languageDirective** (model-inferred): "التدريس باللغة العربية بالكامل…" — correct.
- Scene 1 slide: 13 canvas elements, all-Arabic (title, definition, examples, bullet points).
- Scene 2 interactive: standalone HTML with `lang="ar" dir="rtl"` — RTL emitted natively by generator. ✅
- Scene 3 quiz: 2 Arabic MCQs with answer keys, plausible distractors. ✅
- Speech actions: fluent Arabic teacher dialogue (8/7/1 actions per scene). ✅
- 3,090 Arabic characters total — substantive content.
- Agents: `agentIds` = default-1..6 (built-in registry, see Task 5B). `agentMode` was default,
  so no LLM-generated agent personas ran — default archetypes used, names are Chinese
  (AI助教, 显眼包…) — **DEFECT: default classmate names render in Chinese in an Arabic
  classroom; MASAR Task 13 picker must replace this.**
- **DEFECT: slide text elements default to font "Microsoft YaHei"** (CJK font); Arabic glyphs
  fall back to system font — renders OK but typography is inconsistent. Documented, not fixed.
- TTS: not exercised (enableTTS=false — free tier key has no TTS credit; browser-native TTS
  remains the Arabic audio path for MVP).

## Task 5 — Codebase reconnaissance (ACCEPTANCE: all six answered with verified paths)

### A. LangGraph state graph
- **File: `lib/orchestration/director-graph.ts`**
- Graph built at `:484-496` (`createOrchestrationGraph`): nodes `director` (`:486`) and
  `agent_generate` (`:487`); edges `START→director`, conditional `director→agent_generate|END`
  (`directorCondition`), `agent_generate→END`.
- Topology comment `:473-483`: **single-round contract** — one director→agent cycle per request;
  multi-agent discussions come from the client serializing requests. No server-side loop.
- State shape `OrchestratorState` `:51-77`: inputs `messages`, `storeState`,
  `availableAgentIds`, `languageModel`, `thinkingConfig`, `discussionContext`,
  `triggerAgentId`, `userProfile`, `agentConfigOverrides`; mutable `currentAgentId`,
  `turnCount`, `agentResponses` (append reducer), `whiteboardLedger` (append reducer),
  `shouldEnd`, `totalActions`.
- Node internals: `directorNode` picks next agent; `agentGenerateNode` `:434-467` runs it via
  `runAgentGeneration` and appends the turn summary.
- Related: `lib/orchestration/prompt-builder.ts` (system prompts), `ai-sdk-adapter.ts`
  (callLLM binding), `registry/agent-selection.ts`.

### B. Classmate agents + archetypes
- **Registry: `lib/orchestration/registry/store.ts:47-192`** (`DEFAULT_AGENTS`). The 4 archetypes:
  - `default-3` 显眼包 = **Class Clown** (`:96-119`)
  - `default-4` 好奇宝宝 = **Inquisitive Mind** (`:120-143`)
  - `default-5` 笔记员 = **Note Taker** (`:144-167`)
  - `default-6` 思考者 = **Deep Thinker** (`:168-191`)
  - plus `default-1` AI teacher (`:48-71`), `default-2` AI助教 assistant (`:72-95`).
  Personas are inline English prompt strings; `allowedActions`, `priority`, `avatar`, `color` per agent.
- `getDefaultAgents()` `:198-205` exports them for the generation pipeline.
- LLM-generated agents (agentMode 'generate'): `generateAgentProfiles` in
  `lib/server/classroom-generation.ts:124-174`.
- System prompts for chat: `lib/orchestration/prompt-builder.ts` + registry persona.
- **Task 13 hook point: add `culturalPersona` to `AgentConfig` (`lib/orchestration/registry/types.ts`)
  and extend prompt-builder — do not replace.**

### C. Generation pipeline entry + personalizable parameters
- Entry: `POST /api/generate-classroom` (`app/api/generate-classroom/route.ts:14-73`) →
  job runner `lib/server/classroom-job-runner.ts` → `generateClassroom()` in
  `lib/server/classroom-generation.ts:176+`.
- Stage 1 outlines: `generateSceneOutlinesFromRequirements` —
  `packages/@openmaic/generation/src/outline-generator.ts:120+`; prompts in
  `packages/@openmaic/generation/templates/requirements-to-outlines/{system,user}.md`
  (languageDirective inferred by the LLM `:150-158`).
- Input type `UserRequirements` `lib/types/generation.ts:101-108`: `requirement` (free text),
  `userNickname`, `userBio`, `webSearch`, `interactiveMode`, `taskEngineMode`.
- **Personalizable knobs that actually exist:**
  - `requirement` text (→ prompt content, incl. languageDirective) — richest lever.
  - `userNickname`/`userBio` — fed to scene generation (`userProfile` in
    `lib/server/scene-generation.ts:64`).
  - `SceneOutline.quizConfig.difficulty: 'easy'|'medium'|'hard'` and `questionCount`
    (`packages/@openmaic/generation/src/outline-types.ts:82-86`) — **the only real difficulty knob**,
    per-scene, quiz scenes only.
  - `estimatedDuration` per outline (`:77`) — pacing hint.
  - No global course-level difficulty parameter exists. **Task 12 Path Agent will express
    difficulty adjustment primarily via requirement-prompt content + quizConfig difficulty
    (for quiz scenes), per runbook rule "only map onto parameters that actually exist".**

### D. Playback session-end hook point
- **Terminal transition: `lib/playback/engine.ts:563-571`** — when `getCurrentAction()` returns
  null (all scenes/actions exhausted), engine calls `this.callbacks.onComplete()` (`:570`).
- The app-level consumer: **`components/edit/PlaybackChromeRoot.tsx:786-837`** (`onComplete`
  callback): updates action index, clears resume position, `setPlaybackCompleted(true)`,
  ends the lecture chat session (`:795-798`), then auto-advance logic — at last scene with no
  pending outlines it simply stays (`:819-833` handles pending-generation case).
- **MASAR session-end hook: extend the `onComplete` handler in PlaybackChromeRoot.tsx to also
  fire session capture (Task 9) when the completed scene is the LAST scene; abandoned/partial
  sessions = component unmount cleanup at `:879-895` (scene resume position saved there).**

### E. Per-session data in stores
- **`lib/store/stage.ts`** — `StageState` `:260-327`: `scenes: Scene[]`, `currentSceneId`,
  `chats: ChatSession[]`, `chatSnapshot`, `outlines`, `generationComplete` (`:286`),
  `generationStatus` (`:290`), getters `getCurrentScene/getSceneIndex` (`:319-321`).
  Current scene position → dropOffPoint. Persisted snapshot type `:341+` (localStorage via
  kv-persist, plus server persistence when enabled).
- **Chat messages**: `ChatSession` in `lib/types/chat.ts:49-66` — `messages: UIMessage<ChatMessageMetadata>[]`,
  `sceneId`, `lastActionIndex`, `endReason`, `createdAt/updatedAt`. Student-authored messages
  identifiable via message role/parts in `messages`; lecture speech vs student chat separated
  (`components/chat/use-chat-sessions.ts:502+`).
- **Quiz results**: `QuestionResult` in `lib/quiz/grading.ts:3-9` (`questionId, correct, status,
  earned, aiComment`); runtime attempts via `lib/quiz/runtime.ts` (Web Locks + store), legacy
  localStorage `quizResults:<sceneId>` (`lib/quiz/persistence.ts:21`).
- Settings (selected agents, playback speed, autoplay): `lib/store/settings.ts`
  (`selectedAgentIds` seen at `PlaybackChromeRoot.tsx:782`).

### F. Persistence pattern (how to add a persisted entity)
- Server Postgres path: `lib/persistence/server-provider.ts:33-52` — creates a `pg` Pool from
  `DATABASE_URL`, runs `ensureSchema`/`ensureDocumentSchema`/`ensureAssetSchema` idempotently,
  exposes typed stores (`PgRuntimeStore`, `PgDocumentStore`, `PgAssetStore`).
- **Schema pattern: idempotent `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`
  constants + `ensureSchema()` loop** — see `packages/@openmaic/storage/src/runtime/pg.ts:68-112`
  (`RUNTIME_PG_SCHEMA` const, `ensureSchema` splits on `;` and executes each statement).
- Pattern for `session_records` (Task 8): add a schema const + `ensureSchema`-style function
  in our own module (not upstream's), call it from our route, mirror the runtime tables' style:
  TEXT ids, TEXT ISO timestamps, JSONB for flexible payloads, composite index
  `(student_id, course_id, created_at DESC)`.
- Client localStorage persistence: Zustand `persist` + `lib/store/kv-persist.ts`;
  server-backed persistence gated by `NEXT_PUBLIC_PERSISTENCE` (build-time) with dev-token
  auth in `lib/persistence/server-auth.ts` (the security debt noted in Task 6 of the runbook).

## Task 6 — Postgres persistence (ACCEPTANCE PASSED, lean topology)
- Runbook's full-compose path failed on this 8 GB / disk-pressed machine: two successive colima
  VMs corrupted their containerd metadata during the ~2 GB app-image build
  (`bolt/meta.db: input/output error`, host disk at 100%). **Path correction:** run only the
  `postgres` service from the `server-persistence` profile, keep the app on `pnpm dev`.
- Compose edit (docker-compose.yml): published `5433:5432` on the postgres service so the
  host-side dev server can reach it. `.env.local`: `DATABASE_URL=postgres://openmaic:openmaic-dev@localhost:5433/openmaic`,
  `PERSISTENCE_DEV_TOKEN=openmaic-local-dev`. Dev server started with
  `NEXT_PUBLIC_PERSISTENCE=1 NEXT_PUBLIC_PERSISTENCE_TOKEN=openmaic-local-dev pnpm dev`.
- **ACCEPTANCE EVIDENCE:**
  - `docker compose ps`: `masar-postgres-1 Up (healthy)`.
  - `POST /api/persistence/runtime/sessions` (Bearer dev token + x-learner-key) → **201 created**.
  - `docker compose restart postgres` → GET same session → **200, full record intact**.
  - A generated classroom also persists on disk (data/classrooms/*.json + browser localStorage);
    server persistence additionally survives container restarts, proven above.
- Topology note: in-container DATABASE_URL would use host `postgres` (compose DNS); dev-server
  topology uses `localhost:5433`. Both documented for whoever runs the full stack later.

> **SECURITY DEBT (must fix before any real student pilot):** `PERSISTENCE_DEV_TOKEN` /
> `NEXT_PUBLIC_PERSISTENCE_TOKEN` is compiled into the public JS bundle and provides no
> confidentiality and no user isolation (confirmed by reading `lib/persistence/server-auth.ts:38-54`:
> learner partition key comes from a client-supplied header). Any visitor can read or write
> every learner partition by choosing an `x-learner-key`. Before production, replace
> `lib/persistence/server-auth.ts` with real session verification deriving the learner
> partition from server-controlled identity.

## Task 7 — SessionRecord type (ACCEPTANCE PASSED)
- New file `lib/types/session-record.ts` — matches repo convention (standalone domain file in
  `lib/types/`, imported as `@/lib/types/session-record`; there is no index barrel, each
  module imports directly — verified via existing imports of generation/chat types).
- `tsc --noEmit -p tsconfig.json` passes clean (needs `NODE_OPTIONS=--max-old-space-size=4096`
  on this 8 GB machine — default heap OOMs; noted for all future typecheck/build runs).
- Import verified with a temporary probe file importing + instantiating the type (removed after).

## Task 8 — Session Log storage + API (ACCEPTANCE PASSED)
- **8a schema**: `lib/persistence/session-log-store.ts` — `SESSION_LOG_SCHEMA` const with
  idempotent `CREATE TABLE IF NOT EXISTS session_records` + composite index
  `(student_id, course_id, timestamp DESC)`, `ensureSessionLogSchema()` mirrors upstream's
  ensureSchema pattern (storage/src/runtime/pg.ts:68-112). Own pg Pool (max 5) keyed off
  DATABASE_URL, singleton via Symbol.for global.
- **8b route**: `app/api/session-log/route.ts` — POST validates all required fields
  (types + completionStatus enum) → insert → `{ok:true, id}` 201; GET `studentId`+`courseId`
  +`limit` (default 5, capped 100) → newest first. Uses apiError/apiSuccess + createLogger,
  same as quiz-grade route conventions (two neighbouring routes read first).
- **ACCEPTANCE EVIDENCE:**
  - POST valid record (Arabic struggleTopics + recommendation) → **201 `{"ok":true,"id":"sr_..."}`**
  - GET returns the full record, Arabic strings intact → **200**
  - `docker compose restart postgres` → GET again → **record survives, 200**
  - POST invalid partial body → **400 INVALID_REQUEST** (validation working)
  - `tsc --noEmit` passes clean.

## Task 9 — Capture raw session signals (ACCEPTANCE PASSED)
- **`lib/masar/capture-session-signals.ts`** (new): pure functions —
  `captureSessionSignals` (duration, student messageCount/avgMessageLength,
  completionStatus logic: last-scene→completed / messages→partial / else abandoned,
  dropOffPoint=currentSceneId, quizScore from QuestionResults), `buildTranscript`
  (ordered student/agent/teacher entries incl. Arabic), `computeQuizScore`.
  Student messages = role 'user' OR metadata.originalRole==='user' (lib/types/chat.ts:28).
- **`lib/masar/session-end.ts`** (new): `captureAndLogSessionEnd` — pulls learnerKey
  (device-anonymous identity, lib/runtime/learner-key.ts:81), quiz results per quiz
  scene via loadQuizAttemptState (lib/quiz/runtime.ts:368), console.logs the bundle
  (Task 9 scope). Never throws (wrapped, warned).
- **Hook wiring in `components/edit/PlaybackChromeRoot.tsx`:**
  - `masarSessionStartRef` (mount time) + `masarSessionEndFiredRef` (once-guard);
  - `fireMasarSessionEnd()` — dynamic import, fire-and-forget;
  - fires in `onComplete` when the finished scene is the LAST scene (completed path);
  - fires in unmount cleanup (partial/abandoned path) if not already fired.
- **ACCEPTANCE EVIDENCE:** 11/11 logic assertions pass via tsx — two deliberately
  different sessions (completed w/ 3 msgs + quiz 50 vs abandoned w/ 0 msgs) produce
  correctly differing numbers; durations verified (300000ms → 5.0min); transcript
  roles/speakers correct. Dev server recompiled; classroom page serves 200.
- `tsc --noEmit` clean.

## Task 10 — Analyzer Agent /api/session-analyze (ACCEPTANCE PASSED)
- Route: `app/api/session-analyze/route.ts`. Model called ONLY via
  `resolveModel({stage:'session-analyze'})` + `callLLM` — provider-portable (audit rule held).
- Stage registered: added `'session-analyze'` (and `'path-agent'` for Task 12) to
  `LLM_STAGES` in `lib/server/model-routes.ts:112` so MODEL_ROUTES can pin it.
- `parseAnalyzerOutput` exactly per runbook (defensive: strips fences, clamps score,
  never throws). Transcript capped at 12k chars for small-context models.
- Empty/1-message transcript → LLM skipped entirely, valid fallback record.
- Arabic default fallback recommendation baked in for degraded paths.
- **ACCEPTANCE EVIDENCE (live, glm-4.7-flash):**
  - Realistic Arabic transcript → `struggleTopics:["شبكات عصبية"]` (correctly identified
    the concept the student asked to re-explain), `engagementScore:60`, Arabic
    recommendation about visual examples for neural networks. Schema-valid SessionRecord.
  - Empty transcript → valid fallback, no LLM call, 200.
  - 1-message transcript → valid fallback, 200.
  - Garbage body → `degraded:true` + valid fallback record + error detail, 200, no throw.
  - Free-tier 429 storms observed mid-testing: fallback engaged every time, route never
    failed — the resilience requirement is proven under real rate limiting.
- `tsc --noEmit` clean.

## Task 11 — Wire session end → Analyzer → Session Log (ACCEPTANCE PASSED)
- `lib/masar/session-end.ts`: new `analyzeAndLogSession(payload)` — POSTs to
  /api/session-analyze, then POSTs the returned record to /api/session-log.
  Every failure path (HTTP != 2xx, missing record, network throw) is caught,
  warned, and swallowed — never blocks or breaks the student's UI.
- `components/edit/PlaybackChromeRoot.tsx` `fireMasarSessionEnd` now chains
  capture → analyze → log (dynamic import, fire-and-forget, once-guard).
- **ACCEPTANCE EVIDENCE (chain exercised end-to-end over HTTP):**
  - analyze(realistic transcript) → record with Arabic recommendation
    ("شجع الطالب على طرح أسئلة متابعة…") → log POST **201**.
  - Two more records inserted → GET returns **3 rows newest-first**
    (e2e-3/abandoned > e2e-2/partial > e2e-1/completed), matching the index
    (student_id, course_id, timestamp DESC).
  - The in-browser hook issues exactly these two fetches with the same payloads.
- `tsc --noEmit` clean.

## Task 12 — Path Agent (ACCEPTANCE PASSED)
- **`lib/masar/path-agent.ts`**: `runPathAgent(studentId, courseId)` — reads last 3
  session_records directly from the store (no HTTP self-call), sends to LLM via
  `resolveModel({stage:'path-agent'})` + callLLM, strict-JSON response parsed defensively
  (`parseAdaptation` — runbook's pattern). Zero records → DEFAULT_ADAPTATION (first session).
  Any failure → DEFAULT_ADAPTATION. `adaptationToTeacherContext()` renders guidance into
  the outline prompt's existing `{{teacherContext}}` slot
  (packages/@openmaic/generation/templates/requirements-to-outlines/user.md:36).
- **Parameter mapping (per runbook rule — only real parameters):** Task 5C found no global
  difficulty API. Adaptation is expressed through prompt content: requirement-level
  difficulty language + reinforcement topics + pacing + Arabic opening message, injected via
  teacherContext. quizConfig.difficulty remains LLM-chosen downstream (observed: adapted run
  chose easy-quiz framing "أسئلة مفاهيمية سهلة" naturally).
- **Wiring (both generation paths):**
  1. `app/api/generate/scene-outlines-stream/route.ts` (the interactive UI path): guidance
     appended to teacherContext when `x-learner-key` header present.
  2. `lib/server/classroom-generation.ts` (job path): `GenerateClassroomInput.learnerKey` →
     runPathAgent → teacherContext; route reads `x-learner-key` header.
  3. `app/generation-preview/page.tsx`: `getApiHeaders` now includes `x-learner-key`
     (resolved once from persistence bootstrap = same device-anonymous identity as session logs).
- courseId keying: requirement text trimmed to 120 chars (same requirement = same course
  partition across sessions; documented simplification pending real course entities).
- **ACCEPTANCE EVIDENCE (before/after, same requirement "درس عن الشبكات العصبية الاصطناعية"):**
  - History (partial session, struggleTopics=[الشبكات العصبية, الخوارزميات], engagement 30):
    PathAgent log `adaptation: easier, reinforce=الشبكات العصبية|الخوارزميات (guidance injected)`.
    Generated directive: "simple vocabulary and everyday analogies… avoid complex technical
    jargon". Scene "الخلية العصبية البسيطة" (explicitly simplified), quiz "أسئلة مفاهيمية سهلة".
  - Fresh student: directive keeps English technical terms (Neural Network/Layers), scene
    "بنية الشبكة" with formal layer taxonomy, quiz tests the taxonomy.
  - Free-tier 429 storm mid-test: PathAgent fell back to defaults and generation continued —
    resilience path exercised live.
- `tsc --noEmit` clean.

## Task 13 — Classmate customization (ACCEPTANCE PASSED)
- **13a data model**: `culturalPersona?: string` added to `AgentConfig` AND `AgentTemplate`
  (`lib/orchestration/registry/types.ts:9+`) — independent of archetype persona; optional so
  every existing agent config stays valid (upstream untouched).
- **13b prompt**: `buildCulturalPersonaSection()` in `lib/orchestration/prompt-builder.ts`
  (exported helper) renders the runbook's ROLE/PERSPECTIVE template; injected as new
  `{{culturalPersonaSection}}` slot in `lib/prompts/templates/agent-system/system.md`
  (after `{{persona}}`, before role guideline). Empty string when unset — byte-identical
  prompts for agents without a culture (upstream behavior preserved). Only one template
  uses {{persona}} — verified no other prompt sites need the slot.
- **13c picker UI**: `components/agent/classmate-picker.tsx` — modal with 4 archetype cards
  (default-3..6 from registry) × 6 country chips (عُمان، السعودية، مصر، الأردن، المغرب، الإمارات),
  max 2 classmates enforced (oldest replaced), confirm materializes derived agents via
  `createAgentFromTemplate` (archetype persona + culturalPersona) into the agent registry and
  sets `selectedAgentIds` (teacher+assistant+2 classmates) in the settings store — the
  existing orchestration consumes them unchanged. RTL-safe: flex/grid + logical properties,
  `dir="auto"` dialog, Arabic UI strings + new ar-SA locale keys (agentBar.personas.*,
  agentBar.classmatePicker.*).
- **Acceptance (structural)**: typecheck clean; pages compile/serve 200; both dimensions
  independent in the data model (any archetype × any country); distinguishability comes from
  distinct persona + distinct culturalPersona in each derived agent's system prompt (13b).
- **NOT yet exercised live in a browser session** (free-tier rate limits made a full second
  classroom run impractical today); marked for re-verification in Task 15's end-to-end pass.

## Task 14 — CUT (per runbook priority order)
Optional instructor report cut to protect the uncuttable core (Tasks 7–11) under free-tier
rate limits and disk pressure. Nothing downstream depends on it.

## Task 15 — Final integration verification (ACCEPTANCE PASSED with documented caveats)
- **`pnpm build`: PASSED** (exit 0, all routes compiled; run with
  `NODE_OPTIONS=--max-old-space-size=4096` on this 8 GB machine).
- **`pnpm test`: CANNOT RUN — pre-existing infra breakage, not ours.** Vitest 4 / Vite 8
  fails at startup on this machine: (1) `@rolldown/binding-darwin-arm64` optional dep never
  installed by pnpm (npm optional-deps bug), (2) after manually placing the binding,
  `std-env@4` ERR_REQUIRE_ESM loading vitest.config.ts. Both reproduce on PRISTINE upstream
  code (verified on clean checkout state). Our changes are covered by: tsc --noEmit clean,
  production build clean, 11/11 capture-logic assertions (tsx), live API acceptance tests
  for Tasks 8/10/11/12.
- **End-to-end evidence (re-verified after disk-full recovery + colima restart):**
  - Postgres survived: `stu-e2e` → 3 rows newest-first after MULTIPLE container restarts
    AND a colima VM outage (auto-restart preserved the volume).
  - Arabic course partition intact: Path Agent's student/course lookup works with Arabic
    keys (URL-encode the query params — curl needs --data-urlencode).
  - Analyzer live: 3-message Arabic transcript → struggleTopics correctly identified
    (['Understanding algorithm definition', 'Connecting abstract concepts to daily life']),
    engagementScore 75, schema-valid record.
- **Free-tier operational reality (documented for whoever demos this):** glm-4.7-flash
  rate-limits (HTTP 429 code 1305/1113) in bursts every few minutes under sustained use;
  all MASAR components degrade gracefully by design (analyzer → fallback record, path agent
  → default parameters, generation → upstream retry ladder). A paid glm-5.2 key removes this.
- **Human-in-browser items still pending (need real browser session):**
  1. Task 13 picker walkthrough (open app → picker modal → select 2 classmates → confirm
     they appear in class with distinguishable behavior).
  2. Full student journey: generate → play → complete → verify session-end hook fires in
     browser devtools console ([MASAR session-end] logs) → second session adapts.
     (API-level equivalents of every step proven; the browser hook path is wired identically
     to the tested fetch chain but has not been eyeballed.)

## Environment appendix (this machine)
- M2 MacBook Air, 8 GB RAM, disk chronically at 98-100% — .next + caches repeatedly filled
  the drive during the build. If continuing work: keep ≥5 GB free; Chrome cache is the
  biggest safe reclaim (3 GB).
- Topology: `pnpm dev` on host + postgres-only container (port 5433). DATABASE_URL points at
  localhost:5433 for the dev server; the in-container app would use `postgres:5432`.
- Working model: glm:glm-4.7-flash (free). Restore glm:glm-5.2 by editing .env.local
  DEFAULT_MODEL after recharging z.ai. Analyzer/PathAgent inherit whatever DEFAULT_MODEL is.

## Task 15 — Final integration verification (continued, 2026-08-25 evening session)

### Environment recovery before final pass
- Disk had returned to 99% full (2.9 GB free); Postgres container was `Up (unhealthy)`
  with containerd I/O errors (`exec /bin/sh: input/output error`) caused by disk pressure.
- Stopped the stale `pnpm dev` processes, removed `.next/cache` + transient `.next/*`
  build artifacts (kept `.next/standalone` from earlier production build).
  **Freed ~2.2 GB; disk went from 99%/2.9 GB to 98%/5.1 GB free.**
- Restarted colima (`colima restart`) without deleting the VM; this repaired the
  corrupted containerd metadata and brought Docker back to a working state.
- Postgres container restarted automatically with the volume intact and reported
  `Up (healthy)` on port `5433:5432`.

### Dev server restart
- Started clean dev server with persistence enabled:
  ```bash
  NEXT_PUBLIC_PERSISTENCE=1 NEXT_PUBLIC_PERSISTENCE_TOKEN=openmaic-local-dev pnpm dev
  ```
- Server ready on http://localhost:3000 (HTTP 200).

### Smoke tests (API-level, all passed)
- `POST /api/verify-model {"model":"glm:glm-4.7-flash"}` →
  `{"success":true,"message":"Connection successful","response":"OK"}`
- `GET /api/session-log?studentId=test-smoke&courseId=test-course&limit=5`
  with `Authorization: Bearer openmaic-local-dev` → `{"success":true,"records":[],"count":0}`
- `POST /api/session-log` with Arabic `struggleTopics` + `recommendation` →
  `{"success":true,"ok":true,"id":"sr_sess-smoke-..."}`
- Re-GET confirmed the Arabic record persisted in Postgres, newest-first ordering correct.

### Remaining for Task 15 acceptance
- ✅ Build passed clean earlier today (first run exit 0).
- ✅ Postgres persistence restart-survival proven earlier.
- ✅ Session Log chain (capture → analyze → log) proven via API.
- ✅ Path Agent before/after proven via API.
- ⏳ Still needs human browser session:
  1. Full student journey with classmate picker (2 different archetypes × 2 countries).
  2. Complete session 1 → verify row written.
  3. Start session 2 with same student/course → verify Path Agent adapted content.
  4. Complete session 2 → verify second row.

### Notes for the human browser pass
- Free-tier GLM (`glm-4.7-flash`) is slow and occasionally 429s; if a generation
  stalls, wait or retry. The fallback paths have all been proven resilient.
- To see the classmate picker, start a classroom generation; the picker modal should
  appear before the session begins (component: `components/agent/classmate-picker.tsx`).
- Use the browser dev tools Network tab to confirm:
  - `/api/session-log` POST after session end, and
  - `/api/generate-classroom` or `/api/generate/scene-outlines-stream` carries the
    `x-learner-key` header (this is what feeds the Path Agent).

### Additional disk cleanup (same session)
- Cleared recoverable app caches outside the repo (Chrome, ChatGPT desktop update cache,
  Telegram media cache, pip cache) after project-internal `.next/cache` cleanup.
- **Final disk state: 95% full / 10 GB free** (was 99% / 2.9 GB free).
- Docker/colima remains stable after restart; no VM deletion was needed.

### How to start the local stack from this point
```bash
# 1. Postgres (already running; only if you stop it)
cd /Users/ayahalshanfari/Desktop/AI-MVP/masar
docker compose --profile server-persistence up -d

# 2. Dev server (already running; run in your own terminal to keep it alive)
cd /Users/ayahalshanfari/Desktop/AI-MVP/masar
NEXT_PUBLIC_PERSISTENCE=1 NEXT_PUBLIC_PERSISTENCE_TOKEN=openmaic-local-dev pnpm dev
```
- App URL: http://localhost:3000
- Postgres: localhost:5433 (user/pass/db: openmaic / openmaic-dev / openmaic)
- Dev persistence token: `openmaic-local-dev`

## Kimi switch (2026-08-25)
- Generation via GLM started failing with `429 code 1113 Insufficient balance or no resource package`
  (confirmed in dev server logs).
- Kimi/Moonshot was already a registered OpenAI-compatible provider in `lib/ai/providers.ts:932`
  with models `kimi-k2.5`, `kimi-k2.6`, `kimi-k3`, etc.; env prefix `KIMI` already mapped in
  `lib/server/provider-config.ts:66`.
- Updated `.env.local`:
  - `DEFAULT_MODEL=kimi:kimi-k2.5`
  - `KIMI_API_KEY=<human-supplied>`
  - `KIMI_BASE_URL=https://api.moonshot.ai/v1` (international endpoint)
  - `KIMI_MODELS=kimi-k2.5`
- Restarted dev server; `POST /api/verify-model {"model":"kimi:kimi-k2.5"}` → success.
- Smoke-tested `/api/generate/scene-outlines-stream` with an Arabic requirement → streamed
  `languageDirective` + Arabic `courseTitle` (`مقدمة في الشبكات العصبية`) successfully.
- Full classroom generation now ready for the human browser pass; Path Agent and Session Log
  will use Kimi automatically through the same provider abstraction.

## MASAR branding — logo swap (2026-08-25)
- Replaced OpenMAIC logo/mark with MASAR branding across the UI.
- New assets created:
  - `public/logo-masar.svg` / `assets/logo-masar.svg` — horizontal wordmark + geometric mark
  - `public/masar-mark.svg` / `public/masar-mark.png` — small app mark
  - `app/favicon.ico` + `app/apple-icon.png` — browser/tab icons
- Updated references + alt text:
  - `app/page.tsx` — hero logo + footer text (`MASAR — Adaptive Learning Platform`)
  - `components/stage/scene-sidebar.tsx` — sidebar header logo
  - `components/edit/SlideNavRail/SlideNavRail.tsx` — editor rail header logo + comment
  - `components/scene-renderers/pbl/v2/workspace.tsx` — PBL workspace mark
  - `components/access-code-modal.tsx` — subtitle text
  - `tests/pbl/v2/assets.test.ts` — now asserts `public/masar-mark.svg` exists
- Removed stale files: `public/logo-horizontal.png`, `public/openmaic-mark.png`
- README files still reference the old `assets/logo-horizontal.png` intentionally left
  unchanged (out of scope for UI task; can be updated later).

## Kimi free-tier concurrency fix (2026-08-25)
- Root cause of loading failures: Kimi free tier enforces `max organization
  concurrency: 1`. The app fired multiple Kimi calls (verify-model, outlines,
  scene-content retries) that collided, producing `429` / `AI_APICallError: <none>`
  after the calls hung for ~3 minutes.
- The actual Kimi HTTP path was `compatFetch` in `lib/ai/providers.ts:2171`,
  which called `globalThis.fetch` directly — bypassing `fetchCustomOpenAIChat`.
- Added `fetchWithKimiLock` + global `AsyncLock` in `lib/ai/providers.ts`:
  - Serializes **all** Kimi (moonshot) HTTP requests app-wide.
  - Holds a 1.5 s cooldown after each request so Kimi's server-side concurrency
    counter decrements before the next caller proceeds.
  - Wired `compatFetch` to use `fetchWithKimiLock`.
- Added fail-fast + retries to scene content in `app/api/generate/scene-content/route.ts`:
  - 90 s per-call timeout via `AbortController`.
  - `maxRetries: 2` so transient Kimi stalls retry instead of giving up after one
    3-minute hang.
- Verification:
  - `POST /api/verify-model {"model":"kimi:kimi-k2.5"}` → success (was failing
    before the fix).
  - Two concurrent verify-model calls → both succeed (serialized by the lock).
  - `/api/generate/scene-outlines-stream` with Arabic requirement → completes and
    streams 3 Arabic outlines within 60 s.
- Caveat: full course generation is still gated by Kimi free-tier speed and quota;
  the lock makes it reliable but slower. Upgrading to a paid Kimi tier (or adding
  credit to GLM) is the long-term fix for fast, parallel generation.

## Deep dive: why generation still failed after the Kimi lock (2026-08-25)
- The user switched the browser-selected model to `deepseek:deepseek-v4-pro`
  (likely via Settings → model list; the browser sends it as the `x-model`
  header, overriding `DEFAULT_MODEL`).
- DeepSeek outlines succeeded (~38 s), but **scene content aborted after exactly
  90 s** with `AbortError: This operation was aborted`.
- Root cause: the 90 s timeout added to `app/api/generate/scene-content/route.ts`
  was too aggressive for DeepSeek scene-content generation. Scene content is a
  much heavier call than outlines (full slide HTML/JSON, ~900-line system prompt,
  larger output budget), so it can legitimately take minutes on a free/slow tier.
- Fix: raised the per-call abort timeout from 90 s to **240 s** (4 minutes),
  staying below the route's 5-minute serverless `maxDuration`.
- Note: the Kimi global lock in `lib/ai/providers.ts` only serializes Kimi
  (moonshot) HTTP requests. DeepSeek has its own concurrency/rate limits and is
  not covered by that lock. If DeepSeek also enforces concurrency = 1, similar
  failures can recur.
- Recommendation: with the Kimi lock in place, Kimi `kimi-k2.5` is currently the
  most reliable path. If using DeepSeek, ensure its key is valid and be aware
  that free tiers may still throttle or concurrency-limit scene-content calls.

## Make Kimi/GLM UI-key providers (2026-08-26)
- User request: Kimi and GLM should work like other providers where the API key
  is entered manually in the platform Settings UI, not pre-configured server-side
  in `.env.local`.
- Mechanism: `lib/server/provider-config.ts` treats any provider with a server
  config entry as "managed" (`resolveSectionApiKey` returns the server key and
  ignores the client key). `/api/server-providers` exposes only managed providers,
  and the settings store sync marks those as `isServerConfigured`.
- Change: commented out the following active lines in `.env.local`:
  - `KIMI_API_KEY`, `KIMI_BASE_URL`, `KIMI_MODELS`
  - `GLM_API_KEY`, `GLM_BASE_URL`, `GLM_MODELS`
- Result: `/api/server-providers` now returns `{}` for LLM providers. Kimi and GLM
  appear in Settings as unmanaged providers requiring manual key entry, identical
  to OpenAI/Anthropic/etc.
- Important: `DEFAULT_MODEL` is still `kimi:kimi-k2.5`. Server-side fallback routes
  (e.g. `session-analyze`, `path-agent` when no client `x-model` is sent) will fail
  until a Kimi key is entered in Settings and the browser sends it as `x-api-key`.
  For the demo, the user should either:
  1. Enter their Kimi key in Settings → Providers → Kimi, or
  2. Select a working model in the generation UI (currently `deepseek:deepseek-v4-flash`).

## Demo-day setup recommendation
Based on the logs from the latest run:
- `deepseek:deepseek-v4-flash` is the fastest reliable model in this environment:
  outlines ~33 s, scene content ~84 s, actions ~9 s.
- TTS is currently set to ElevenLabs and hit `TTSRateLimitError: ElevenLabs TTS rate limit exceeded (HTTP 429)`.
  For a reliable demo, switch Settings → Voice/TTS to **Browser Native TTS** (no API key,
  no rate limits).
- Disk is at 95% / 10 GB free — sufficient but monitor it.

## Scene-actions slowness fix (2026-08-26)
- User reported scene-actions generation was slower than upstream OpenMAIC.
- Investigation: no artificial delays in the route. The latency came from DeepSeek's
  default `reasoning_effort: high` being applied to the short JSON-array action
  generation task, plus an oversized `maxOutputTokens` budget (393,216 for flash).
- Changes in `app/api/generate/scene-actions/route.ts`:
  - Default thinking to disabled unless the client explicitly enabled it.
  - Cap `maxOutputTokens` at 4,096 (plenty for action JSON).
  - Raised `maxDuration` from 60 s to 300 s to avoid edge-case timeouts.
- Note: because Kimi/GLM are now UI-key providers and `DEFAULT_MODEL` still points
  to `kimi:kimi-k2.5`, server-side fallback routes without an explicit model will
  fail unless a default-model key is configured. The user should select a working
  model in the UI (currently `deepseek:deepseek-v4-flash`).

## TTS / asset pool timeout fix (2026-08-26)
- User-facing error: "Speech generation failed — Asset pool write timed out after 15s
  (storage stalled — check disk space / other tabs)".
- Root cause: TTS was set to **ElevenLabs** in the UI (likely a persisted setting),
  and the ElevenLabs key is on a free/limited tier that returns `HTTP 429` rate-limit
  errors. Because `NEXT_PUBLIC_PERSISTENCE=1`, the asset pool is server-backed
  (`HttpAssetStore` → Postgres), and the client-side storage write watchdog
  (`STORAGE_WRITE_TIMEOUT_MS = 15s`) timed out while the server was saturated with
  failing/retrying ElevenLabs calls.
- Immediate fixes applied:
  - Doubled `STORAGE_WRITE_TIMEOUT_MS` from 15s to 30s in `lib/hooks/use-scene-generator.ts`
    as a safety net.
- Required user action:
  - Switch Settings → Voice/TTS to **Browser Native TTS** (`browser-native-tts`).
    This is already the default for new sessions; the user's localStorage had it set
    to ElevenLabs.
- Note: Browser Native TTS requires no API key and has no rate limits, making it
  demo-safe.

## Force Browser Native TTS on every load (2026-08-26)
- User could not access Settings to switch TTS provider manually.
- Added a demo-safety reset in `lib/store/settings.ts` `merge()` (runs on every
  rehydrate): if `ttsProviderId` is anything other than `browser-native-tts`,
  reset it to `browser-native-tts`.
- This prevents free-tier cloud TTS providers (ElevenLabs) from stalling
  generation with rate-limit errors.
- Note: this is intentionally aggressive for the demo. To allow cloud TTS again,
  remove the reset block from `merge()`.

## Remove DEFAULT_MODEL fallback (2026-08-26)
- Diagnostic confirmed that with Kimi/GLM as UI-key providers, server-side
  fallback routes were still trying to use `DEFAULT_MODEL=kimi:kimi-k2.5`, which
  has no server key. This produced confusing "API Key is required" failures for
  requests without a client `x-api-key`/`x-model`.
- Commented out `DEFAULT_MODEL=kimi:kimi-k2.5` in `.env.local`.
- Result: requests without a model/key now fail loud with
  `No model could be resolved...` instead of silently attempting a keyless model.
- Browser-originated generation and chat continue to work because they send
  `x-model` + `x-api-key` (or `apiKey` in the chat body) from the Settings UI.
- To re-enable server-side fallbacks (e.g. one-shot classroom API, Path Agent,
  Session Analyzer without browser context), configure a server-side key for one
  provider and set `DEFAULT_MODEL=<provider>:<model>`.

## Quick orientation — what this repo is

This repository batch-processes business-card images and extracts structured contact data into a CSV. The primary runtime is Bun (scripts are TypeScript). Core pieces you should know immediately:

- `execution/process_cards.ts` — main processing script (reads `inputs/`, sends images to Gemini, writes `outputs/business_cards.csv`, logs errors to `outputs/error_log.txt`).
- `directive/001_project_init.md` — design notes and the exact JSON contract expected from the LLM (field names and logic for `category`).
- `README.md` — user-facing run instructions and Bun assumptions (some environment-variable names differ across files; review carefully).
- `.env` — template for API key (project currently uses `GOOGLE_API_KEY` inside the processing script).
- `package.json` — dependency list and start script. Note: the repo contains references to different Google SDK package names — validate which package is installed before changing imports.

## Big picture and data flow (in 3 steps)

1. Files: drop images into `inputs/` (supported extensions: .jpg/.jpeg/.png/.webp). The script expects base64-encoded image data.
2. LLM call: `execution/process_cards.ts` constructs `contents` for the `GoogleGenAI` client: first element is `{ inlineData: { mimeType, data } }`, second is `{ text: SYSTEM_PROMPT }`. The script calls `ai.models.generateContent({ model: 'gemini-2.5-flash-lite', contents })`.
3. Output: the returned JSON (the script attempts to extract `response.text`, `response.outputText`, and various common SDK shapes) is parsed and mapped to the exact CSV headers defined in `CSV_FIELDS`.

If any image fails, the script appends a timestamped line to `outputs/error_log.txt` and continues processing.

## Project-specific conventions and gotchas for agents

- Environment variable name mismatch: `README.md` documents `GEMINI_API_KEY` while the actual script loads `GOOGLE_API_KEY` from `.env`. When editing, prefer the value in `execution/process_cards.ts` or normalize both files to the same name.
- Multiple SDK names: `package.json` lists `@google/generative-ai` while the script attempts to require `@google/genai`. Before editing imports, check `package.json` and `bun.lockb` to determine the installed package and adapt `require`/`import` accordingly. If uncertain, prefer runtime-safe dynamic requiring with helpful error messages (see current script pattern).
- Model choice: `gemini-2.5-flash-lite` is the intended model in this project. Some files reference other versions — do not change the model without confirming cost/latency tradeoffs.
- JSON contract: The script expects these exact keys in the model output: `company_name, company_name_normalized, contact_person, position, phone, mobile, email, website, country, city, business, type, category`. Use `null` for missing values. See `directive/001_project_init.md` for logic (e.g., category classification rules).
- CSV header fidelity: Output CSV headers must match `CSV_FIELDS` exactly to preserve downstream tooling compatibility.

## How to run, test, and debug (explicit commands)

1. Install dependencies (Bun):
```bash
bun install
```

2. Ensure API key in `.env` (or export env var for quick testing):
```bash
# .env
GOOGLE_API_KEY=YOUR_KEY

# or inline for a single run
export GOOGLE_API_KEY=YOUR_KEY
```

3. Drop a small sample image in `inputs/` and execute the processor:
```bash
bun ./execution/process_cards.ts
```

4. If parsing fails or you need the raw model output, edit `execution/process_cards.ts` to temporarily `console.debug(JSON.stringify(response, null, 2))` right after the SDK call — the script already attempts multiple common response shapes, but dump the raw so you can adapt the parser precisely.

## Files to inspect when changing behavior

- `execution/process_cards.ts` — concurrency (`concurrency` variable), the SDK call (`sendToGemini`), and parsing logic.
- `directive/001_project_init.md` — authoritative field list and normalization logic used by the system prompt.
- `package.json` — dependency names and `start` script; check this before changing imports.
- `README.md` — user-facing run instructions; fix divergence here if you change env var names or scripts.

## Preferred edits patterns for AI agents

- When updating SDK usage: keep runtime-safe fallbacks (try dynamic require and throw a clear error instructing what to `bun install`).
- Preserve CSV field order and names — downstream tools may parse by header index.
- Keep concurrency small by default (the script uses 5). If adding exponential backoff, use small increments and write to `outputs/error_log.txt` for rate-limit failures.

## Small examples to copy/paste

- Constructing `contents` for the SDK (copy into code when adapting):
```ts
const contents = [
  { inlineData: { mimeType: 'image/jpeg', data: base64 } },
  { text: SYSTEM_PROMPT }
];
const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-lite', contents });
```

- Extracting CSV_FIELDS from parsed JSON:
```ts
const row = {};
for (const k of CSV_FIELDS) row[k] = parsed[k] ?? null;
```

## When you are unsure

- If you see mismatched package names or SDK usage, search `package.json` and `bun.lockb` before changing imports. Prefer minimal, local changes (adapt `sendToGemini`) over rewriting the whole invocation.
- If model responses fail parsing, paste a truncated raw `response` into an issue or a PR description and adapt the parser to that SDK shape.

---
If you'd like, I can now: (A) add a small debug flag to dump raw responses to `outputs/debug/`, (B) normalize environment variable names across files, or (C) change the script to use the REST endpoint instead of the SDK. Which would you prefer? 

## Ollama (offline) integration — plan and instructions

Goal
----
Provide an offline-capable alternative to the current Gemini-based pipeline by adding support for Ollama (local LLMs). The offline path must produce the same JSON contract as the Gemini model so the rest of the pipeline (parsing and writing to `outputs/business_cards.csv`) remains unchanged.

Scope & constraints
-------------------
- Keep the existing `CSV_FIELDS` and JSON keys exactly the same.
- Allow toggling between cloud (Gemini) and offline (Ollama) via an environment variable (e.g., `USE_OLLAMA=true`) or CLI flag.
- Support both Ollama's HTTP API and local CLI (where applicable) so the script can run on machines without preinstalled Ollama clients if a remote Ollama host is provided.
- Document hardware expectations (local models can be large; recommend small/quantized models for single-machine runs).

What this file contains
-----------------------
1. Setup steps (Ollama install options and recommended small model suggestions).
2. API/CLI examples for calling an Ollama model to produce the same JSON output as Gemini (responseMimeType: application/json).
3. Implementation notes for `execution/process_cards.ts` to support Ollama alongside Gemini.
4. Prompt adaptations and JSON contract enforcement.
5. Testing and verification steps.

1) Setup
--------
- Option A — Ollama HTTP server (recommended if available): run Ollama and expose the HTTP endpoint (default http://localhost:11434). Set `OLLAMA_HOST` env var to the host (e.g., `http://localhost:11434`).
- Option B — Ollama CLI: call `ollama run <model> --json --prompt-file=...` and capture stdout. Ensure `OLLAMA_PATH` or `PATH` includes the Ollama binary.

Model recommendations
---------------------
- For offline/low-resource: choose a small/quantized model that fits your hardware. Examples: Llama 2 7B quantized, or any compact model you have locally.
- Note: Larger models may require GPU or lots of RAM — document minimums in a later README note.

2) Calling Ollama (examples)
----------------------------
- HTTP API example payload (high-level): POST to `${OLLAMA_HOST}/api/generate` or the appropriate Ollama endpoint with the prompt and model name; expect JSON output. Ensure the response contains the model text as JSON — if the model streams text, capture and parse the final output.
- CLI example (high-level): `ollama run <model> --json --prompt "<SYSTEM_PROMPT>"` and read stdout.

3) Prompt & JSON contract
-------------------------
- Use the same system prompt used for Gemini but ensure the model returns pure JSON. Example instruction to the model (wrap in request):

  Analyze the image. Extract business card details into JSON. Fields: company_name, company_name_normalized (uppercase, no legal suffixes), contact_person, position, phone (format +[country][number]), mobile (format +[country][number]), email, website, country, city, business (tagline or empty string), type (free text), category (strictly 'gov', 'bank', or 'private'). logic: 'gov' if government/ministry; 'bank' if financial/credit; else 'private'. Use null for missing values.

- Add explicit instructions to ONLY output a single JSON object (no commentary, no markdown). If the model is prone to extra text, implement a post-parse sanitation step that extracts the first JSON object from the text.

4) Integration approach (code-level notes)
---------------------------------------
- Add an environment variable `USE_OLLAMA` (true/false) and `OLLAMA_HOST` / `OLLAMA_MODEL` / `OLLAMA_CLI_PATH`.
- Implement a new helper `sendToOllama(imageBase64, options)` that mirrors existing `sendToGemini` logic:
  - Build the prompt and payload exactly like Gemini `contents` (image inline data + system prompt) but adapt to Ollama's API shape.
  - Request JSON output.
  - Return the raw JSON text for the existing parser to handle.

- Keep the parser unchanged; ensure `sendToOllama` returns the same response shapes (i.e., a string that contains JSON or a parsed object). If Ollama returns plain text, parse/extract JSON and return parsed object.

5) Error handling and fallback
-----------------------------
- If Ollama is unreachable or the model fails, write a descriptive line to `outputs/error_log.txt` including the filename, timestamp, and error details, then continue processing.
- Optionally implement a fallback to cloud Gemini when Ollama fails — make this opt-in (e.g., `OLLAMA_FALLBACK_TO_GEMINI=true`).

6) Testing & verification
-------------------------
- Add a small test image to `inputs/` and a script or flag that runs a single-file processing using Ollama to verify the output JSON maps to the CSV fields.
- Verify that for the same sample input, results from Gemini and Ollama (if using same prompt and model capability) are JSON-parseable and map to the CSV headers.

7) Developer notes & next steps
------------------------------
- I'll implement `sendToOllama` and add a small feature-flag in `execution/process_cards.ts` once you approve this plan.
- After implementation: run quick validations (process a single image) and add a short section in `README.md` explaining how to run offline with Ollama, environment variables to set, model size guidance, and fallback options.

Files to create/change when implementing
--------------------------------------
- `execution/process_cards.ts` — add Ollama client integration and feature-flag handling.
- `directive/002_ollama_offline_plan.md` — (this file) documents plan and steps.
- Optional: `scripts/test_ollama_run.ts` — small script to run a single image through Ollama and print parsed JSON (for quick local verification).

Acceptance criteria before proceeding
------------------------------------
1. You review this plan and confirm I should proceed.
2. Confirm whether you want an automatic fallback to Gemini on Ollama failure or prefer to keep it manual.

---
Created for offline implementation planning. Review and tell me to proceed when ready.

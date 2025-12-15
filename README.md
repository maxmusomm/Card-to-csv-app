# Card to CSV Scanner

Batch-process a directory of business-card images, extract structured contact details using Google Gemini, and save the results to a CSV.

Requirements
- Bun (v1.x)
- A Google API key for Gemini set in the `.env` file as `GOOGLE_API_KEY` (see note about env names below)

Quick setup
1. Install dependencies:

```bash
bun install
```

2. Create input/output folders (the script will create them automatically on first run if missing):

```bash
mkdir -p inputs outputs
```

3. Add your API key to `.env` (file created at project root):

```bash
# .env
GOOGLE_API_KEY=YOUR_KEY_HERE
```

Run the processor

```bash
bun ./execution/process_cards.ts
```

What the script expects and produces
- Inputs: drop images into `inputs/` (supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`).
- Outputs:
  - `outputs/business_cards.csv` — the final CSV with the following headers (order preserved):
    `company_name,company_name_normalized,contact_person,position,phone,mobile,email,website,country,city,business,type,category`
  - `outputs/error_log.txt` — timestamped error lines for any image that fails to process.

Batching and rate limits
- The current script processes images in small batches of 2, then pauses for 2 minutes 30 seconds before processing the next batch. This behavior is implemented in `execution/process_cards.ts` (see `batchSize` / `pauseMs`). Change those values in the script if you need different throttling.

Gemini SDK and SDK name caveats
- The codebase references different SDK package names in places (`@google/generative-ai`, `@google/genai`). Before changing imports, check `package.json` and `bun.lockb` to determine which package is actually installed. The script includes a clear area to adapt the SDK call (`processImageWithGemini` / `sendToGemini`).
- Model used: `gemini-2.5-flash` (the script requests `responseMimeType: application/json`). Do not change the model unless you understand cost/latency tradeoffs.

Debugging tips
- If parsing fails, enable a raw dump of the model response by inserting a `console.debug(JSON.stringify(response, null, 2))` right after the SDK call in `execution/process_cards.ts`.
- Check `outputs/error_log.txt` for per-image failures.
- The script expects the model to return a JSON object containing the exact keys listed above; missing fields are written as `null` in the CSV.

Notes
- The README previously referenced `index.ts` and `cards/` — the current implementation lives at `execution/process_cards.ts` and uses `inputs/`/`outputs/` folders. Update documentation if you change filenames or env var names.
- If you prefer to configure batch size or pause via environment variables, I can add `BATCH_SIZE` and `BATCH_PAUSE_SECONDS` support.

If you want, I can update the README further to include example `bun install` output, runtime troubleshooting steps, or a short example of a raw model response and how to adapt the parser. 
# Project initialization

## User requirements

- Process a batch of business card images placed in `inputs/`.
- For each image, extract structured business-card data using Google Gemini (`gemini-2.5-flash-lite`).
- Output a single CSV at `outputs/business_cards.csv` whose headers match the JSON fields exactly.
- Log any processing errors to `outputs/error_log.txt` and continue processing.
- Provide an `.env` file for `GOOGLE_API_KEY`.

## Logic flow

1. Load environment variables from `.env` (expect `GOOGLE_API_KEY`).
2. Read all images (jpg, jpeg, png, webp) from `inputs/`.
3. For each image:
   - Convert the file to Base64.
   - Send the image to the Gemini model `gemini-2.5-flash-lite`.
   - Configure the model request to return JSON (responseMimeType: `application/json`).
   - Use a system prompt that instructs the model to return a JSON object with the exact fields listed below.
   - Parse the response JSON and normalize/massage values as needed.
   - On error, append an entry to `outputs/error_log.txt` and continue.
4. After all images processed, write results to `outputs/business_cards.csv` with headers matching the JSON keys.

## Model

- Model: `gemini-2.5-flash-lite` (chosen for cost-effectiveness and speed for OCR/analysis tasks)

## JSON output contract (fields)

- company_name
- company_name_normalized (uppercase, no legal suffixes)
- contact_person
- position
- phone (format: +[country][number] or null)
- mobile (format: +[country][number] or null)
- email
- website
- country
- city
- business (tagline or empty string)
- type (free text)
- category (one of: 'gov', 'bank', 'private')

Notes:
- Use `null` for missing values.
- `category` detection logic: 'gov' if government/ministry, 'bank' if financial/credit, otherwise 'private'.

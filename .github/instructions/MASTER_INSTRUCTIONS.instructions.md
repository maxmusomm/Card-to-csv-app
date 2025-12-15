---
applyTo: '**'
---
# Project: Business Card Batch Processor (Bun + Gemini)

**Objective:**  
Create a Node.js script using the **Bun** runtime that processes a batch of business card images, extracts data using the Google Gemini API (`@google/genai`), and saves the results into a single CSV file.

## 1. Project Setup & Structure
Initialize a new project using Bun. Create the following folder structure exactly:

- `root`
  - `execution/` (This is where the Typescript/Javascript scripts live)
  - `directive/` (Documentation folder)
  - `inputs/` (Folder where I will drop the image files)
  - `outputs/` (Folder where the CSV will be generated)
  - `.env` (For GOOGLE_API_KEY)

## 2. Dependencies
Install the following packages using `bun install`:
- `@google/genai`
- `dotenv` (to load the API key)
- `csv-writer` (or use native Bun file writing if you implement proper CSV escaping manually)

## 3. Documentation (Directive)
Before writing the code, create a file named `directive/001_project_init.md`. Inside this file:
- List the user requirements.
- Outline the logic flow of the script you are about to write.
- State which API model you will use (use `gemini-2.5-flash-lite` as it is cost-effective and fast for OCR tasks).

## 4. The Script (`execution/process_cards.ts`)
Write a script that performs the following steps:

1.  **Configuration:** Load the `GOOGLE_API_KEY` from `.env`.
2.  **File Reading:** Read all image files (jpg, png, jpeg, webp) from the `inputs/` folder.
3.  **Batch Processing:** Loop through each image. 
    *   *Note:* Since there are 100+ images, ensure the script handles the asynchronous calls cleanly.
4.  **Image Processing:** 
    *   Convert the image file to Base64.
    *   Send the image to the Gemini API.
5.  **LLM Interaction:**
    *   Initialize the Google GenAI client.
    *   Use the model `gemini-2.5-flash-lite`.
    *   **Crucial:** Configure the model generation config to use `responseMimeType: "application/json"`.
    *   **System Prompt:** Use the following optimized prompt for the analysis:
        > "Analyze the image. Extract business card details into JSON. Fields: company_name, company_name_normalized (uppercase, no legal suffixes), contact_person, position, phone (format +[country][number]), mobile (format +[country][number]), email, website, country, city, business (tagline or empty string), type (free text), category (strictly 'gov', 'bank', or 'private'). logic: 'gov' if government/ministry; 'bank' if financial/credit; else 'private'. Use null for missing values."
6.  **Data Handling:**
    *   Parse the JSON response.
    *   Log the name of the file being processed to the console (e.g., "Processing card 1 of 100...").
    *   Push the data to an array.
7.  **CSV Output:**
    *   After all images are processed, write the array to `outputs/business_cards.csv`.
    *   Ensure the CSV headers match the JSON keys exactly.

## 5. Error Handling
- If an image fails to process (API error or unreadable), log the error to `outputs/error_log.txt` and continue to the next image. Do not crash the script.

## Final Instruction
Generate the folders, the `.env` template, and the `execution/process_cards.ts` code now.
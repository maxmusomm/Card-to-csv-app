/*
  Batch business-card processor for Bun + Google Gemini (Fixed)
*/

import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
// We use the stable package '@google/generative-ai'
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const consolePath = process.argv[2]

// CONFIGURATION
const ROOT = path.resolve(process.cwd()); // Better root detection for Bun
const INPUT_DIR = path.join(ROOT, consolePath ||'inputs');
const OUTPUT_DIR = path.join(ROOT, 'outputs');
const ERROR_LOG = path.join(OUTPUT_DIR, 'error_log.txt');
const CSV_PATH = path.join(OUTPUT_DIR, 'business_cards.csv');
const SUPPORTED_EXT = /(\.jpe?g$|\.png$|\.webp$)/i;

const SYSTEM_PROMPT = `
Analyze the image. Extract business card details into JSON. 
Fields: company_name, company_name_normalized (uppercase, no legal suffixes), contact_person, position, phone (format +[country][number]), mobile (format +[country][number]), email, website, country, city, business (tagline or empty string), type (free text), category (strictly 'gov', 'bank', or 'private'). logic: 'gov' if government/ministry; 'bank' if financial/credit; else 'private'. Use null for missing values.
`;

const CSV_FIELDS = [
  'company_name', 'company_name_normalized', 'contact_person', 
  'position', 'phone', 'mobile', 'email', 'website', 
  'country', 'city', 'business', 'type', 'category',
];

// --- HELPERS ---

function ensureDirs() {
  if (!existsSync(INPUT_DIR)) mkdirSync(INPUT_DIR, { recursive: true });
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
}

function logError(msg: string) {
  const timestamp = new Date().toISOString();
  // Ensure output dir exists before logging error
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  appendFileSync(ERROR_LOG, `[${timestamp}] ${msg}\n`);
}

function cleanJsonString(text: string): string {
  // Remove markdown code blocks (```json ... ```)
  let clean = text.replace(/```json/g, '').replace(/```/g, '');
  return clean.trim();
}

// --- CORE LOGIC ---

async function processImageWithGemini(filePath: string) {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is missing from .env file');
  }

  // 1. Read Image
  const fileBuffer = await fs.readFile(filePath);
  const base64Data = fileBuffer.toString('base64');
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  // 2. Setup Client
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite",
    generationConfig: { responseMimeType: "application/json" } // Force JSON
  });

  // 3. Generate
  const result = await model.generateContent([
    { inlineData: { data: base64Data, mimeType: mimeType } },
    SYSTEM_PROMPT
  ]);

  const response = await result.response;
  const text = response.text();

  return text;
}

async function sendToOllama(base64Data: string, mimeType: string) {
  const model = process.env.OLLAMA_MODEL || 'qwen3-vl:4b';
  const host = process.env.OLLAMA_HOST; // e.g. http://localhost:11434
  const prompt = `${SYSTEM_PROMPT}\n\n{"inlineData": { "mimeType": "${mimeType}", "data": "<BASE64_IMAGE>" }}\n\nRespond ONLY with a single JSON object.`;

  // Replace image placeholder with a short hint; many local models don't accept raw base64 images.
  // But we still include the base64 as separate field so that multimodal endpoints can use it.
  const payloadPrompt = prompt.replace('<BASE64_IMAGE>', base64Data);

  if (host) {
    // Try common endpoints. If your Ollama HTTP server differs, set OLLAMA_HOST accordingly.
    const endpoints = ['/api/generate', '/v1/generate', '/generate'];
    const base = host.replace(/\/$/, '');
    for (const ep of endpoints) {
      try {
        const res = await fetch(`${base}${ep}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: payloadPrompt })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const text = await res.text();
        return text;
      } catch (err) {
        // try next endpoint
      }
    }
    throw new Error('Failed to reach Ollama HTTP API. Checked common endpoints; verify OLLAMA_HOST.');
  }

  // Fallback to CLI if no host provided
  const ollamaPath = process.env.OLLAMA_CLI_PATH || 'ollama';
  try {
    // Use execFileSync for simplicity — ensure the prompt isn't too large for your environment.
    const out = execFileSync(ollamaPath, ['run', model, '--json', '--prompt', payloadPrompt], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    });
    return out as string;
  } catch (err: any) {
    throw new Error(`Ollama CLI failed: ${err.message || err}`);
  }
}

async function processImage(filePath: string) {
  // Wrapper that chooses Ollama or Gemini based on env toggle
  if (process.env.USE_OLLAMA === 'true') {
    // Read image here and call Ollama helper
    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    // Optionally attempt Ollama and fall back to Gemini if configured
    try {
      const text = await sendToOllama(base64Data, mimeType);
      return text;
    } catch (err) {
      const fallback = process.env.OLLAMA_FALLBACK_TO_GEMINI === 'true';
      if (fallback) {
        console.error(`Ollama failed, falling back to Gemini: ${(err as any).message}`);
        return processImageWithGemini(filePath);
      }
      throw err;
    }
  }

  // Default path: Gemini
  return processImageWithGemini(filePath);
}

async function processAll() {
  ensureDirs();
  
  const files = await fs.readdir(INPUT_DIR);
  const imageFiles = files.filter((f) => SUPPORTED_EXT.test(f)).map(f => path.join(INPUT_DIR, f));

  if (imageFiles.length === 0) {
    console.log(`No images found in ${INPUT_DIR}`);
    return;
  }

  console.log(`Found ${imageFiles.length} images. Starting batch process...`);
  
  const results: any[] = [];
  const batchSize = 2; // process 2 images per cycle
  const pauseMs = 60_000; // 1 minutes pause between batches

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // Process images in small batches and pause between each batch to respect rate limits
  for (let i = 0; i < imageFiles.length; i += batchSize) {
    const batch = imageFiles.slice(i, i + batchSize);
    const batchPromises = batch.map(async (filePath) => {
      const fileName = path.basename(filePath);
      
      try {
  console.log(`Processing: ${fileName}`);
  const jsonString = await processImage(filePath);
        
        // Clean and Parse
        const cleaned = cleanJsonString(jsonString);
        const data = JSON.parse(cleaned);
        
        // Normalize headers
        const row: any = {};
        CSV_FIELDS.forEach(field => {
          row[field] = data[field] !== undefined ? data[field] : null;
        });
        
        return row;

      } catch (err: any) {
        const errorMsg = `Error processing ${fileName}: ${err.message}`;
        console.error(errorMsg);
        logError(errorMsg);
        return null; // Return null on failure
      }
    });

    // Wait for batch to finish
    const batchResults = await Promise.all(batchPromises);

    // Filter out failed items (nulls) and add to main list
    batchResults.forEach((r) => { if (r) results.push(r); });

    const processed = Math.min(i + batchSize, imageFiles.length);
    if (processed < imageFiles.length) {
      if (process.env.USE_OLLAMA === 'true') {
        console.log(`Processed ${processed}/${imageFiles.length}. USE_OLLAMA=true — continuing without pause.`);
      } else {
        console.log(`Processed ${processed}/${imageFiles.length}. Pausing for ${pauseMs / 1000} seconds before next batch...`);
        await sleep(pauseMs);
      }
    }
  }

  // Write CSV
  if (results.length > 0) {
    const csvWriter = createCsvWriter({
      path: CSV_PATH,
      header: CSV_FIELDS.map(id => ({ id, title: id }))
    });

    await csvWriter.writeRecords(results);
    console.log(`\n✅ Success! Processed ${results.length}/${imageFiles.length} cards.`);
    console.log(`📂 CSV saved to: ${CSV_PATH}`);
  } else {
    console.log("No data was extracted successfully.");
  }
}

// Run if this file is executed directly (Bun specific check)
if (import.meta.main) {
  processAll().catch(err => {
    console.error("Fatal Script Error:", err);
  });
}
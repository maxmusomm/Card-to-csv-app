import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SYSTEM_PROMPT = `Analyze the image. Extract business card details into JSON. Respond ONLY with a single JSON object.`;

function extractFirstJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in response');
  return match[0];
}

async function main() {
  const imgArg = process.argv[2] || path.join(process.cwd(), 'inputs', 'sample.jpg');
  const fileBuffer = await fs.readFile(imgArg);
  const base64Data = fileBuffer.toString('base64');
  const mimeType = imgArg.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const model = process.env.OLLAMA_MODEL || 'qwen3-vl:4b';
  const host = process.env.OLLAMA_HOST;
  const prompt = `${SYSTEM_PROMPT}\n\n{"inlineData": { "mimeType": "${mimeType}", "data": "<BASE64_IMAGE>" }}`.replace('<BASE64_IMAGE>', base64Data);

  if (host) {
    const url = host.replace(/\/$/, '') + '/api/generate';
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt }) });
    const text = await res.text();
    const jsonText = extractFirstJson(text);
    console.log('Parsed JSON:\n', JSON.parse(jsonText));
    return;
  }

  // Try CLI
  const { execFileSync } = await import('child_process');
  const ollamaPath = process.env.OLLAMA_CLI_PATH || 'ollama';
  try {
    const out = execFileSync(ollamaPath, ['run', model, '--json', '--prompt', prompt], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    const jsonText = extractFirstJson(out as string);
    console.log('Parsed JSON:\n', JSON.parse(jsonText));
  } catch (err: any) {
    console.error('Ollama CLI failed:', err.message || err);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

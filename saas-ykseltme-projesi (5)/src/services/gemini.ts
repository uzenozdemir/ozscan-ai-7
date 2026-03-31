// ─────────────────────────────────────────────────────────────────────────────
//  OzScan AI — Gemini Service (Single Source of Truth)
//  All Gemini API calls go through here. Never import fetch/endpoints elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

// ─── API Key ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENV_KEY: string = (import.meta as any).env?.VITE_GEMINI_KEY ?? '';
export const GEMINI_KEY: string = ENV_KEY || 'AIzaSyDKc8yUO8-eexkX9co9yga3eKz8hmugBwc';

// ─── Model candidates ─────────────────────────────────────────────────────────
//  gemini-1.5-flash on v1beta is the most stable & widely available.
//  Cascade stops at the FIRST 200 OK. Removes unstable 2.0 models.
const MODEL_CANDIDATES = [
  // Primary — most stable, GA, widely available
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',          label: 'gemini-1.5-flash (v1beta)' },
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',   label: 'gemini-1.5-flash-latest (v1beta)' },
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent',      label: 'gemini-1.5-flash-002 (v1beta)' },
  // Pro variants
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',            label: 'gemini-1.5-pro (v1beta)' },
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent',     label: 'gemini-1.5-pro-latest (v1beta)' },
  // GA channel fallbacks
  { url: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',              label: 'gemini-1.5-flash (v1)' },
  { url: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent',                label: 'gemini-1.5-pro (v1)' },
  // Legacy fallback
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',                 label: 'gemini-pro (v1beta)' },
];

// ─── Request body builder ─────────────────────────────────────────────────────
function buildBody(prompt: string, maxTokens = 1024) {
  return JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
  });
}

// ─── Low-level cascade fetch ──────────────────────────────────────────────────
//  Tries each model in MODEL_CANDIDATES until one returns HTTP 200.
//  Throws descriptive Error if ALL fail — caller catches and shows friendly UI.
export async function geminiCascadeFetch(prompt: string, maxTokens = 1024): Promise<string> {
  if (!GEMINI_KEY || !GEMINI_KEY.trim()) {
    throw new Error('NO_KEY');
  }

  let lastLabel = '';
  let lastError = '';

  for (const { url, label } of MODEL_CANDIDATES) {
    console.log(`[OzScan AI] 🔄 Trying ${label}…`);
    try {
      const res = await fetch(`${url}?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildBody(prompt, maxTokens),
      });

      const rawBody = await res.text();

      if (res.ok) {
        // Parse the Gemini envelope
        let envelope: unknown;
        try {
          envelope = JSON.parse(rawBody);
        } catch {
          console.error(`[OzScan AI] ❌ ${label} — envelope not JSON:`, rawBody.slice(0, 300));
          lastError = 'Response body is not valid JSON';
          lastLabel = label;
          continue; // try next model
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text: string = (envelope as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!text) {
          console.error(`[OzScan AI] ❌ ${label} — no text in envelope:`, envelope);
          lastError = 'Gemini returned empty content';
          lastLabel = label;
          continue;
        }

        console.log(
          `%c[OzScan AI] ✅ ${label} SUCCESS`,
          'color:#22c55e;font-weight:bold',
          '— first 200 chars:',
          text.slice(0, 200)
        );
        return text; // ← SUCCESS — stop cascade
      }

      // HTTP error — log and try next candidate
      let apiMsg = `HTTP ${res.status}`;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errJson = JSON.parse(rawBody) as any;
        apiMsg = errJson?.error?.message ?? apiMsg;
      } catch { /* keep raw status */ }

      console.warn(`[OzScan AI] ⚠️ ${label} → ${apiMsg}`);
      lastError = apiMsg;
      lastLabel = label;

    } catch (networkErr) {
      const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
      console.warn(`[OzScan AI] ⚠️ ${label} — Network error:`, msg);
      lastError = msg;
      lastLabel = label;
    }
  }

  // All candidates exhausted
  console.error(
    `%c[OzScan AI] ❌ ALL models failed.`,
    'color:#ef4444;font-weight:bold',
    `Last tried: ${lastLabel}. Last error: ${lastError}`
  );
  throw new Error(`GEMINI_ALL_FAILED::${lastError}`);
}

// ─── JSON extractor ───────────────────────────────────────────────────────────
//  Strips markdown fences and parses the first JSON object in a Gemini response.
export function extractJson<T>(text: string): T {
  // Strip ```json ... ``` or ``` ... ``` fences
  let cleaned = text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```$/im, '')
    .trim();

  // If Gemini prepended prose before the JSON, find the first { or [
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const start =
    firstBrace === -1 ? firstBracket :
    firstBracket === -1 ? firstBrace :
    Math.min(firstBrace, firstBracket);
  if (start > 0) cleaned = cleaned.slice(start);

  // Also trim trailing content after last } or ]
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end !== -1 && end < cleaned.length - 1) cleaned = cleaned.slice(0, end + 1);

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error('[OzScan AI] ❌ extractJson failed. Cleaned text:', cleaned.slice(0, 500));
    throw new Error('INVALID_JSON');
  }
}

// ─── Friendly error translator ────────────────────────────────────────────────
//  Converts raw Error messages → user-facing friendly strings (TR or EN).
export function friendlyError(err: unknown, lang: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const isTr = lang === 'tr';

  if (raw === 'NO_KEY') {
    return isTr
      ? 'API anahtarı bulunamadı. Lütfen yöneticinizle iletişime geçin.'
      : 'API key not found. Please contact your administrator.';
  }
  if (raw.startsWith('GEMINI_ALL_FAILED::')) {
    const detail = raw.replace('GEMINI_ALL_FAILED::', '');
    if (/quota|rate.?limit|429/i.test(detail)) {
      return isTr
        ? 'Şu an yoğunluk var, lütfen birkaç dakika bekleyip tekrar deneyin.'
        : 'High traffic right now — please wait a moment and try again.';
    }
    if (/api.?key|invalid.?key|401|403/i.test(detail)) {
      return isTr
        ? 'API anahtarı geçersiz veya yetkisiz. Lütfen tekrar deneyin.'
        : 'Invalid or unauthorized API key. Please try again.';
    }
    if (/not.?found|404/i.test(detail)) {
      return isTr
        ? 'Analiz servisi şu an erişilemiyor. Lütfen birazdan tekrar deneyin.'
        : 'Analysis service unavailable. Please try again in a moment.';
    }
    return isTr
      ? 'Analiz şu an tamamlanamadı. Lütfen birkaç saniye bekleyip tekrar deneyin.'
      : 'Analysis could not complete right now. Please wait a moment and try again.';
  }
  if (raw === 'INVALID_JSON') {
    return isTr
      ? 'Beklenmedik bir yanıt alındı. Lütfen tekrar deneyin.'
      : 'Unexpected response received. Please try again.';
  }

  return isTr
    ? 'Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.'
    : 'An unexpected error occurred. Please try again.';
}

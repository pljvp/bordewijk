// api.js — Claude API + Gemini Image API calls

import * as storage from './storage.js';

export class ApiError extends Error {
  constructor(message, status, raw) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.raw = raw;
  }
}

export async function claudeComplete(messages, systemPrompt, signal) {
  const key = storage.getClaudeKey();
  if (!key) throw new ApiError('Geen Claude API-sleutel ingesteld.', 0, null);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt || '',
      messages,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data.error?.message || `Claude API fout (${resp.status})`;
    throw new ApiError(msg, resp.status, data);
  }
  return data.content?.[0]?.text ?? '';
}

// styleProof: optionele dataUrl van de referentieafbeelding (stijlproef)
export async function geminiGenerateImage(prompt, model, signal, styleProof) {
  const key = storage.getGeminiKey();
  if (!key) throw new ApiError('Geen Gemini API-sleutel ingesteld.', 0, null);

  model = model || storage.getGeminiModel();

  if (model.startsWith('gemini-')) {
    return await _geminiFlash(prompt, key, model, signal, styleProof);
  }
  // Imagen ondersteunt geen directe image-to-image in deze API; stijlproef wordt genegeerd.
  return await _imagen(prompt, key, model, signal);
}

async function _geminiFlash(prompt, key, model, signal, styleProof) {
  // Bouw parts-array: optionele stijlproef-afbeelding vóór de tekstprompt
  const parts = [];
  if (styleProof) {
    const mimeType = styleProof.split(';')[0].replace('data:', '') || 'image/png';
    const b64data  = styleProof.split(',')[1];
    parts.push({ inlineData: { mimeType, data: b64data } });
  }
  parts.push({ text: prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ApiError(data.error?.message || `Gemini API fout (${resp.status})`, resp.status, data);
  }

  const resParts = data.candidates?.[0]?.content?.parts || [];
  const img = resParts.find(p => p.inlineData);
  if (!img) throw new ApiError('Geen afbeelding ontvangen van Gemini Flash.', 0, data);

  return `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`;
}

async function _imagen(prompt, key, model, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1 },
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ApiError(data.error?.message || `Imagen API fout (${resp.status})`, resp.status, data);
  }

  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new ApiError('Geen afbeelding ontvangen van Imagen.', 0, data);

  return `data:image/png;base64,${b64}`;
}

export async function testClaudeConnection(key) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });
  return resp.ok;
}

export async function testGeminiConnection(key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const resp = await fetch(url);
  return resp.ok;
}

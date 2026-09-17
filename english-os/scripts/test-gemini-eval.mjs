/**
 * Local Gemini smoke test — run: node scripts/test-gemini-eval.mjs YOUR_API_KEY
 */
const key = process.argv[2]?.trim();
if (!key) {
  console.error('Usage: node scripts/test-gemini-eval.mjs YOUR_GEMINI_API_KEY');
  process.exit(1);
}

async function listModels() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
    headers: { 'x-goog-api-key': key },
  });
  const data = await res.json();
  if (!res.ok) {
    console.log('LIST FAILED', res.status, JSON.stringify(data).slice(0, 400));
    return [];
  }
  return (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => n.includes('flash') && !n.includes('thinking') && !n.includes('embedding'));
}

async function tryModel(model, jsonMode) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: 'Return JSON only.' }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Evaluate this English: "Yesterday I went to university." Return JSON: {"overall_score":7,"estimated_cefr":"B1","summary":"ok","strengths":["clear"],"improvements":["past tense"],"corrections":[],"coach_note":"Nice work!"}',
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const block = data.promptFeedback?.blockReason;
  const finish = data.candidates?.[0]?.finishReason;
  console.log(
    model,
    jsonMode ? 'json-mode' : 'text-mode',
    res.status,
    'block=',
    block ?? '-',
    'finish=',
    finish ?? '-',
    'text=',
    text ? text.slice(0, 120) : '(empty)',
  );
  if (!res.ok) console.log('  err', JSON.stringify(data).slice(0, 200));
}

const models = await listModels();
console.log('Discovered flash models:', models.slice(0, 8).join(', ') || '(none)');
for (const m of models.slice(0, 3)) {
  await tryModel(m, true);
  await tryModel(m, false);
}

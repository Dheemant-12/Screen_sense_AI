const PROVIDERS = [
  {
    name: 'groq-1',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY_1,
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
  {
    name: 'groq-2',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY_2,
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: process.env.GEMINI_API_KEY,
    model: 'gemini-1.5-flash',
  },
];

export async function POST(req) {
  const { imageBase64, transcript, userKey } = await req.json();

  // If user brought their own key, use it directly
  if (userKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: `Audio: "${transcript}". What is being taught on screen?` },
          ],
        }],
      }),
    });
    const data = await res.json();
    return Response.json({ explanation: data.choices[0].message.content });
  }

  // Try free providers in order
  for (const provider of PROVIDERS) {
    if (!provider.key) continue;

    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
              { type: 'text', text: `Audio: "${transcript}". What is being taught on screen?` },
            ],
          }],
        }),
      });

      if (res.status === 429) continue; // rate limited — try next
      if (!res.ok) continue;

      const data = await res.json();
      return Response.json({
        explanation: data.choices[0].message.content,
        provider: provider.name,
      });
    } catch {
      continue;
    }
  }

  // All free keys exhausted — ask user for their own key
  return Response.json({ quotaExhausted: true }, { status: 429 });
}
const PROVIDERS = [
  {
    name: 'groq-1',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY_1,
    model: 'llama-3.3-70b-versatile',
  },
  {
    name: 'groq-2',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY_2,
    model: 'llama-3.3-70b-versatile',
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: process.env.GEMINI_API_KEY,
    model: 'gemini-1.5-flash',
  },
  {
    name: 'mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    key: process.env.MISTRAL_API_KEY,
    model: 'mistral-small-latest',
  },
];

export async function POST(req) {
  const { transcript, scenes, userKey } = await req.json();

  const systemPrompt = `You are an expert video summarizer. Create structured study notes 
with headings, bullet points, key concepts, and action items. Be thorough and descriptive.`;

  const userContent = `Summarise this session into study notes:

TRANSCRIPT:
${transcript || 'No transcript available.'}

SCENE NOTES:
${scenes || 'No scene notes available.'}`;

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
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });
    const data = await res.json();
    return Response.json({ summary: data.choices[0].message.content });
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
          max_tokens: 1500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      });

      if (res.status === 429) continue;
      if (!res.ok) continue;

      const data = await res.json();
      return Response.json({
        summary: data.choices[0].message.content,
        provider: provider.name,
      });
    } catch {
      continue;
    }
  }

  // All free keys exhausted
  return Response.json({ quotaExhausted: true }, { status: 429 });
}
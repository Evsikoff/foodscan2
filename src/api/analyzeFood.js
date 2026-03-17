import { SYSTEM_PROMPT } from '../constants/prompts';
import { compressImage, fileToBase64 } from '../utils/imageUtils';

export async function analyzeFood(file, onProgress) {
  const compressed = await compressImage(file);
  const base64 = await fileToBase64(compressed);

  const response = await fetch('/api/z/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'glm-4.6v',
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this photo.' },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` }
            }
          ]
        }
      ],
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let reasoning = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;

      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          content += delta.content;
        }
        if (delta.reasoning_content) {
          reasoning += delta.reasoning_content;
          if (onProgress) onProgress(reasoning);
        }
      } catch {}
    }
  }

  const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

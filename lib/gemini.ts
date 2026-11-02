import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { CardSchema, type Card } from './schema';

const SYSTEM = `You are a bilingual English–Ukrainian dictionary for an advanced (CEFR C1) learner. Skip primitive, beginner-level senses and trivial examples: focus on nuanced, less obvious meanings, collocations, connotation and register, and use C1-level vocabulary and natural, sophisticated example sentences. The input may carry a hint in parentheses, e.g. "bank (river)": use that sense. If the input is a full sentence containing the target expression, explain the expression as used there. For the user's input (a word, idiom, phrasal verb or phrase) return ONE JSON object matching the schema. Rules: detect the entry type; fix obvious typos and put the fixed form in \`corrected\`; give 2–3 natural, realistic example sentences with Ukrainian translations; explain nuance and register; if the input is not a real English expression, set type "unknown" and confidence "low" instead of inventing a meaning. Keep definitions concise.`;

export async function lookup(query: string) {
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const started = Date.now();
  const res = await ai.models.generateContent({
    model,
    contents: query,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(CardSchema),
    },
  });

  const card: Card = CardSchema.parse(JSON.parse(res.text ?? ''));
  return {
    card,
    meta: {
      model,
      inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - started,
    },
  };
}

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { CardSchema, type Card, type Level } from './schema';

const LEVEL_GUIDE: Record<Level, string> = {
  'A1-A2': 'Pick the most basic, literal, everyday sense of the entry. Use only very simple words and very short, clear example sentences; keep the English definition to one simple sentence.',
  B1: 'Pick the most common, everyday sense of the entry. Use simple vocabulary and short, clear example sentences.',
  B2: 'Pick the most common sense of the entry, adding a short note on a notable second sense only if it is frequent. Use natural, moderately complex examples.',
  C1: 'Skip primitive, beginner-level senses and trivial examples: focus on nuanced, less obvious meanings, collocations, connotation and register, and use C1-level vocabulary and natural, sophisticated example sentences.',
  C2: 'Treat the learner as near-native: cover subtle shades of meaning, rare and figurative senses, etymological or stylistic notes where useful, precise collocations and register contrasts, and use sophisticated, idiomatic example sentences.',
};

const system = (level: Level) =>
  `You are a bilingual English–Ukrainian dictionary for a CEFR ${level} learner. The learner's level decides WHICH sense of an ambiguous entry to explain and how complex the language is: ${LEVEL_GUIDE[level]} The input may carry a hint in parentheses, e.g. "bank (river)": use that sense. If the input is a full sentence containing the target expression, explain the expression as used there. For the user's input (a word, idiom, phrasal verb or phrase) return ONE JSON object matching the schema. Rules: detect the entry type; fix obvious typos and put the fixed form in \`corrected\`; give 2–3 natural, realistic example sentences with Ukrainian translations; give 3–5 \`synonyms\` for the explained sense, suitable for the ${level} level; explain nuance and register; if the input is not a real English expression, set type "unknown" and confidence "low" instead of inventing a meaning. Keep definitions concise.`;

export async function lookup(query: string, level: Level) {
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 55_000 },
  });

  const started = Date.now();
  const res = await ai.models.generateContent({
    model,
    contents: query,
    config: {
      systemInstruction: system(level),
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(CardSchema),
    },
  });

  const card: Card = CardSchema.parse(JSON.parse(res.text ?? ''));
  return {
    card,
    meta: {
      model,
      level,
      inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - started,
    },
  };
}

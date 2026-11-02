import { z } from 'zod';

export const CardSchema = z.object({
  query: z.string(),
  headword: z.string(),
  type: z.enum(['word', 'idiom', 'phrasal_verb', 'phrase', 'unknown']),
  partOfSpeech: z.string().optional(),
  ipa: z.string().optional(),
  translationUk: z.string(),
  definitionEn: z.string(),
  explanationUk: z.string(),
  register: z.enum(['formal', 'neutral', 'informal', 'slang']).optional(),
  examples: z.array(z.object({ en: z.string(), uk: z.string() })),
  synonyms: z.array(z.string()).optional(),
  relatedPhrases: z.array(z.string()).optional(),
  corrected: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const LEVELS = ['A1-A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];

export type Card = z.infer<typeof CardSchema>;

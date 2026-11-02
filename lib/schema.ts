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
  relatedPhrases: z.array(z.string()).optional(),
  corrected: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type Card = z.infer<typeof CardSchema>;

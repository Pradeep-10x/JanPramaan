/**
 * JanPramaan — Voice / Translation Service
 *
 * Provides free multilingual text translation to English.
 * Uses google-translate-api-x (no API key required).
 *
 * Architecture:
 *  Frontend: Web Speech API captures voice → text in citizen's language
 *  Backend:  This service auto-detects the language and translates to English
 *
 * Supports all major Indian languages: Hindi, Bengali, Tamil, Telugu,
 * Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, and 100+ more.
 */
import translate from 'google-translate-api-x';

/** Supported Indian language codes for reference */
export const INDIAN_LANGUAGES: Record<string, string> = {
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
  or: 'Odia',
  as: 'Assamese',
  sd: 'Sindhi',
  ne: 'Nepali',
  sa: 'Sanskrit',
};

export interface TranslationResult {
  /** Original text as spoken by the citizen */
  originalText: string;
  /** Translated English text */
  translatedText: string;
  /** ISO language code detected (e.g. 'hi', 'ta', 'bn') */
  detectedLanguage: string;
  /** Human-readable language name */
  detectedLanguageName: string;
  /** Whether translation was needed (false if already English) */
  wasTranslated: boolean;
}

/**
 * Auto-detect the language of the input text and translate it to English.
 * If the text is already in English, returns it as-is.
 */
export async function translateToEnglish(text: string): Promise<TranslationResult> {
  if (!text || !text.trim()) {
    throw new Error('Text is required for translation');
  }

  const result = await translate(text, { to: 'en', autoCorrect: true });

  const detectedLang = result.from.language.iso || 'unknown';
  const wasTranslated = detectedLang !== 'en';

  return {
    originalText: text,
    translatedText: result.text,
    detectedLanguage: detectedLang,
    detectedLanguageName: INDIAN_LANGUAGES[detectedLang] || detectedLang,
    wasTranslated,
  };
}

/**
 * Batch translate multiple text fields (e.g. title + description) in one call.
 */
export async function translateFields(
  fields: Record<string, string>,
): Promise<Record<string, TranslationResult>> {
  const results: Record<string, TranslationResult> = {};

  for (const [key, text] of Object.entries(fields)) {
    if (text && text.trim()) {
      results[key] = await translateToEnglish(text);
    }
  }

  return results;
}

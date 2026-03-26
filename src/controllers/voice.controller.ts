/**
 * JanPramaan — Voice controller
 * Handles speech-to-text translation for multilingual civic complaints.
 */
import { Request, Response, NextFunction } from 'express';
import { translateToEnglish, translateFields, INDIAN_LANGUAGES } from '../services/voice.service';

/**
 * POST /api/voice/translate
 * Translate text from any language to English.
 * Body: { text: "मुख्य सड़क पर गड्ढा है" }
 * Returns: { originalText, translatedText, detectedLanguage, ... }
 */
export async function translateText(req: Request, res: Response, next: NextFunction) {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'TEXT_REQUIRED', message: 'Provide a non-empty text field' });
      return;
    }

    const result = await translateToEnglish(text.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/voice/translate-fields
 * Translate multiple fields at once (title + description).
 * Body: { title: "पानी की समस्या", description: "नल से पानी नहीं आ रहा" }
 * Returns: { title: { translatedText, ... }, description: { translatedText, ... } }
 */
export async function translateMultipleFields(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description } = req.body;
    const fields: Record<string, string> = {};
    if (title && typeof title === 'string') fields.title = title.trim();
    if (description && typeof description === 'string') fields.description = description.trim();

    if (Object.keys(fields).length === 0) {
      res.status(400).json({ error: 'NO_FIELDS', message: 'Provide at least a title or description to translate' });
      return;
    }

    const results = await translateFields(fields);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/voice/languages
 * Returns the list of supported Indian languages with their codes.
 * Helps the frontend show a language picker if Web Speech API isn't available.
 */
export async function listLanguages(_req: Request, res: Response) {
  const languages = Object.entries(INDIAN_LANGUAGES).map(([code, name]) => ({
    code,
    name,
    speechApiCode: `${code}-IN`,  // BCP-47 code for Web Speech API (e.g. "hi-IN")
  }));
  res.json({ languages });
}

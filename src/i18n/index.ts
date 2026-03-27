/**
 * JanPramaan — i18n helper functions
 * Provides t(), tNotify(), and tEnum() for bilingual string resolution.
 */
import { Lang, errors, messages, notifications, enumLabels, validation } from './translations.js';

/** Resolve language string to supported Lang type */
function resolveLang(lang?: string): Lang {
  return lang === 'hi' ? 'hi' : 'en';
}

/**
 * Translate an error code.
 * Falls back: translation[lang] → translation['en'] → fallback → code
 */
export function tError(code: string, lang?: string, fallback?: string): string {
  const l = resolveLang(lang);
  const entry = errors[code];
  if (entry) return entry[l] || entry.en;
  return fallback || code;
}

/**
 * Translate a success/message code.
 */
export function tMessage(code: string, lang?: string, fallback?: string): string {
  const l = resolveLang(lang);
  const entry = messages[code];
  if (entry) return entry[l] || entry.en;
  return fallback || code;
}

/**
 * Translate a notification string with interpolation.
 * Placeholders: {0}, {1}, {2}, etc.
 */
export function tNotify(key: string, lang?: string, ...args: (string | number)[]): string {
  const l = resolveLang(lang);
  const entry = notifications[key];
  if (!entry) return key;
  let text = entry[l] || entry.en;
  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, String(arg));
  });
  return text;
}

/**
 * Translate an enum value for display.
 * Returns translated label or original value if not found.
 */
export function tEnum(enumName: string, value: string, lang?: string): string {
  const l = resolveLang(lang);
  const group = enumLabels[enumName];
  if (!group) return value;
  const entry = group[value];
  if (!entry) return value;
  return entry[l] || entry.en;
}

/**
 * Translate a validation template with interpolation.
 */
export function tValidation(key: string, lang?: string, ...args: string[]): string {
  const l = resolveLang(lang);
  const entry = validation[key];
  if (!entry) return key;
  let text = entry[l] || entry.en;
  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, arg);
  });
  return text;
}

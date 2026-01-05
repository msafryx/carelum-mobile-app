// Simple i18n helper - can be replaced with i18next later
import { Language, LANGUAGES } from '@/src/config/constants';

// Placeholder translations - will be loaded from JSON files
const translations: Record<Language, Record<string, string>> = {
  [LANGUAGES.ENGLISH]: {},
  [LANGUAGES.SINHALA]: {},
  [LANGUAGES.TAMIL]: {},
};

export function t(key: string, language: Language = LANGUAGES.ENGLISH): string {
  return translations[language]?.[key] || key;
}

export function loadTranslations(language: Language, translationsData: Record<string, string>) {
  translations[language] = translationsData;
}

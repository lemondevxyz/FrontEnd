import i18next from 'i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

const LANG_STORAGE_KEY = 'landing-lang';
const RTL_LANGUAGES = new Set(['ar']);

const getBaseLanguage = (language?: string) => (language || 'en').split('-')[0];

export const getLanguageDirection = (language?: string) =>
  RTL_LANGUAGES.has(getBaseLanguage(language)) ? 'rtl' : 'ltr';

const applyDocumentLanguage = (language?: string) => {
  if (typeof document === 'undefined') return;

  const baseLanguage = getBaseLanguage(language);
  document.documentElement.lang = baseLanguage;
  document.documentElement.dir = getLanguageDirection(baseLanguage);
};

const savedLang = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_STORAGE_KEY) : null;

void i18next.init({
  lng: savedLang === 'en' ? 'en' : 'ar',
  fallbackLng: 'ar',
  resources: {
    ar: {
      translation: ar,
    },
    en: {
      translation: en,
    },
  },
  interpolation: {
    escapeValue: false,
  },
}).then(() => applyDocumentLanguage(i18next.language));

i18next.on('languageChanged', applyDocumentLanguage);

export const t = i18next.t.bind(i18next);
export default i18next;

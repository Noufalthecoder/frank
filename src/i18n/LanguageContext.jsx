import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations.js';
import { translateProductName, translateCategory } from './productTamil.js';

const LANG_STORAGE_KEY = 'tsp_app_language';

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  t: (key) => key,
  tName: (name) => name,
  tCategory: (cat) => cat,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'ta' || saved === 'en') return saved;
    } catch (_) {}
    return 'en';
  });

  useEffect(() => {
    document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (_) {}
  }, [lang]);

  const setLang = (next) => {
    if (next === 'en' || next === 'ta') setLangState(next);
  };

  const toggleLang = () => {
    setLangState((prev) => (prev === 'en' ? 'ta' : 'en'));
  };

  // t('key') or t('key', { n: 3 }) — replaces {n} placeholders in the translated text
  const t = (key, params) => {
    const dict = translations[lang] || translations.en;
    let text = dict[key] ?? translations.en[key] ?? key;
    if (params) {
      Object.keys(params).forEach((p) => {
        text = text.split(`{${p}}`).join(String(params[p]));
      });
    }
    return text;
  };

  const tName = (name) => translateProductName(name, lang);
  const tCategory = (cat) => translateCategory(cat, lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, tName, tCategory }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

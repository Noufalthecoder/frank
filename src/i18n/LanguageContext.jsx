import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations.js';

const LANG_STORAGE_KEY = 'tsp_app_language';

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  t: (key) => key,
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

  const t = (key) => {
    const dict = translations[lang] || translations.en;
    return dict[key] ?? translations.en[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import en from "@/locales/en.json";
import cs from "@/locales/cs.json";

export type Locale = "en" | "cs";

const dictionaries: Record<Locale, Record<string, string>> = { en, cs };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && (saved === "en" || saved === "cs")) {
      setLocaleState(saved);
      document.cookie = `locale=${saved};path=/;max-age=31536000`;
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>) => {
      let value = dictionaries[locale][key] || dictionaries.en[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, v);
        }
      }
      return value;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LocaleProvider");
  }
  return context;
}

"use client";

import { useTranslation, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  const nextLocale: Locale = locale === "en" ? "cs" : "en";
  const label = locale === "en" ? "CZ" : "EN";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(nextLocale)}
      className="font-semibold"
    >
      {label}
    </Button>
  );
}

"use client";

import { useLanguage } from "@/components/i18n/language-context";
export function LanguageSelect() {
  const { lang, setLang } = useLanguage();

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      className="bg-transparent text-white border border-white/30 rounded-md px-2 py-1 text-sm outline-none cursor-pointer hover:bg-white/10"
    >
      <option value="en" className="text-black">
        English
      </option>
      <option value="bn" className="text-black">
        Bengal
      </option>
    </select>
  );
}

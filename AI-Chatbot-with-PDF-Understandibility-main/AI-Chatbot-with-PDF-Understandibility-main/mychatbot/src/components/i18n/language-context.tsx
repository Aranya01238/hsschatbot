"use client"

import React, { createContext, useContext, useState } from "react"

type LanguageContextType = {
    lang: string
    setLang: (lang: string) => void
}

const LanguageContext = createContext<LanguageContextType>({
    lang: "en",
    setLang: () => { },
})

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [lang, setLang] = useState("en")
    return (
        <LanguageContext.Provider value={{ lang, setLang }}>
            {children}
        </LanguageContext.Provider>
    )
}

export const useLanguage = () => useContext(LanguageContext)

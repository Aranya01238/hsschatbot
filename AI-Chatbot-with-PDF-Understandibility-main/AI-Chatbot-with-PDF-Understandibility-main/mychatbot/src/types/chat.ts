/**
 * Type definitions for Nurse Maya chatbot
 * Ensures type safety across the entire application
 */

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
  timestamp?: number
}

export interface PDFContext {
  filename: string
  totalPages: number
  extractedText: string
  characterCount: number
  isValid: boolean
}

export interface ChatRequest {
  question: string
  history: ChatMessage[]
  lang: string
  pdfContext?: PDFContext | null
}

export interface ChatResponse {
  answer: string
  demo: boolean
  reason?: string
  lang: string
  model?: string
  apiVersion?: "v1" | "v1beta"
  streaming?: boolean
}

export interface PDFParseResult {
  success: boolean
  text: string
  pageCount: number
  filename: string
  error?: string
  characterCount: number
}

export interface PromptCompositionContext {
  systemPrompt: string
  nursePersona: string
  chatHistory: ChatMessage[]
  userMessage: string
  pdfContext: string
  language: string
}

export type SupportedLanguage = "en" | "hi" | "bn" | "mr" | "gu" | "ta"

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  ta: "Tamil",
}

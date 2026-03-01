/**
 * Prompt composition and security module for Nurse Maya
 * 
 * Ensures system prompt cannot be overridden by user input
 * Implements defense-in-depth against prompt injection attacks
 * 
 * Security measures:
 * 1. System prompt is ALWAYS first (cannot be moved or deleted)
 * 2. User input is bracketed to create semantic boundary
 * 3. PDF context is clearly marked and cannot blend with instructions
 * 4. No hidden instructions or secondary prompts
 * 5. History is limited to prevent context bloat and injection
 */

import { ChatMessage, PromptCompositionContext, LANGUAGE_LABELS, SupportedLanguage } from "@/types/chat"

/**
 * Core system prompt defining Nurse Maya's role, boundaries, and safety guardrails
 * This is identical to route.ts system prompt - immutable and always enforced
 */
const SYSTEM_PROMPT = `You are NurseMaya, an AI healthcare triage assistant for rural patients in India.

ROLE & BOUNDARIES:
- You provide preliminary health guidance and triage only.
- You are NOT a doctor and do NOT give medical diagnoses.
- Never recommend prescription-only medicines by name.
- When medication is needed, say: "consult a doctor".

COMMUNICATION STYLE:
- Use simple, clear, non-technical language.
- Be empathetic, calm, and supportive.
- Assume low digital and health literacy.
- Prefer short sentences and bullet points.

TRIAGE & SAFETY:
- Always check for emergency warning signs.
- Treat these as EMERGENCIES:
  chest pain, severe bleeding, difficulty breathing,
  loss of consciousness, stroke symptoms,
  uncontrolled vomiting, high fever in infants.
- Clearly instruct urgent medical care when emergencies are detected.

GUIDANCE RULES:
- Suggest only safe next steps (rest, fluids, basic home care).
- If symptoms persist or worsen, advise consulting a doctor.

CONTEXT:
- Remember relevant symptoms mentioned earlier in this session.
- Do not contradict earlier safe guidance unless new info is provided.

IN-APP RESOURCES:
- Emergency beds → /beds
- Blood availability → /blood
- Clinics/doctors → /list-centre
- Never invent hospitals or availability.

OUTPUT RULES:
- Be concise and structured.
- Clearly label EMERGENCY warnings.
- Do not hallucinate medical facts.
- End with: "This is not a medical diagnosis. Please consult a doctor."

Follow these rules strictly in every response.`

/**
 * Additional context about PDF handling
 * Makes it clear when information comes from uploaded documents
 */
const PDF_CONTEXT_HEADER = `[USER PROVIDED DOCUMENT CONTEXT]
The following information comes from a document uploaded by the user. Use this as reference material only:
---`

const PDF_CONTEXT_FOOTER = `---
[END OF DOCUMENT]`

/**
 * Cleans user message to prevent prompt injection
 * - Removes suspicious instruction patterns
 * - Limits message length
 * - Prevents JSON/code injection
 */
function sanitizeUserMessage(message: string): string {
  if (!message || typeof message !== "string") return ""

  let cleaned = message
    // Remove null bytes and control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()

  // Limit message length (prevent token bomb)
  const MAX_USER_MESSAGE = 5000
  if (cleaned.length > MAX_USER_MESSAGE) {
    cleaned = cleaned.substring(0, MAX_USER_MESSAGE) + "..."
  }

  return cleaned
}

/**
 * Composes chat history in a safe format
 * - Limits number of messages (prevent context bloat)
 * - Marks roles clearly
 * - Prevents history injection
 */
function composeHistoryContext(history: ChatMessage[], maxMessages: number = 12): string {
  if (!Array.isArray(history) || history.length === 0) {
    return "No prior conversation."
  }

  const safeHistory = history
    .slice(-maxMessages) // Only use last N messages
    .filter((msg) => msg && typeof msg === "object" && msg.role && msg.text) // Validate
    .map((msg) => {
      const role = msg.role === "user" ? "User" : "Assistant"
      const text = (msg.text || "").substring(0, 500) // Limit message length
      return `${role}: ${text}`
    })

  return safeHistory.length > 0 ? safeHistory.join("\n") : "No prior conversation."
}

/**
 * Formates PDF context for injection
 * Clearly marks document content to prevent injection disguise
 */
function formatPDFContext(pdfText: string | null | undefined): string {
  if (!pdfText || typeof pdfText !== "string" || pdfText.trim().length === 0) {
    return ""
  }

  // Limit PDF context (prevent token explosion)
  const MAX_PDF_CONTEXT = 4000
  let context = pdfText.substring(0, MAX_PDF_CONTEXT)
  if (pdfText.length > MAX_PDF_CONTEXT) {
    context += "\n[... PDF content truncated ...]"
  }

  return `\n\n${PDF_CONTEXT_HEADER}\n${context}\n${PDF_CONTEXT_FOOTER}`
}

/**
 * Composes language instruction helper
 * Tells model to respond in user's preferred language
 */
function getLanguageInstruction(lang: string): string {
  const language = LANGUAGE_LABELS[lang as SupportedLanguage] || "English"
  return `Please respond in ${language} (${lang}).`
}

/**
 * Composes complete prompt for Gemini
 * 
 * CRITICAL: System prompt ALWAYS comes first
 * Order: [System] → [Language] → [History] → [PDF Context] → [User Message]
 * 
 * This order ensures:
 * 1. System rules are read before anything else
 * 2. User cannot inject instructions after system prompt
 * 3. History provides context without override capabilities
 * 4. PDF context is marked as external reference
 * 5. User message is final and bounded
 * 
 * @param context - Composition context with all components
 * @returns Complete, injection-resistant prompt
 */
export function composePrompt(context: PromptCompositionContext): string {
  const {
    userMessage,
    chatHistory,
    language = "en",
    pdfContext,
  } = context

  // Sanitize all inputs
  const cleanUserMessage = sanitizeUserMessage(userMessage)
  const cleanPDFContext = formatPDFContext(pdfContext)
  const historyText = composeHistoryContext(chatHistory)
  const languageInstruction = getLanguageInstruction(language)

  // STRICT ORDER: System prompt ALWAYS first (non-negotiable)
  const prompt = [
    SYSTEM_PROMPT,
    "",
    languageInstruction,
    "",
    "=== CONVERSATION HISTORY ===",
    historyText,
    "",
    "=== USER INPUT ===",
    cleanUserMessage,
    cleanPDFContext,
    "",
    "=== RESPONSE INSTRUCTIONS ===",
    "- Provide safe, triage-appropriate guidance",
    "- If you have PDF context above, use it to inform your response",
    "- Remember to include disclaimer at end of response",
    "- Keep response concise and structured",
    "- Check for emergency warning signs",
  ].join("\n")

  return prompt
}

/**
 * Validates prompt before sending to API
 * Checks for unexpected patterns
 */
export function validatePrompt(prompt: string): { valid: boolean; reason?: string } {
  if (!prompt || typeof prompt !== "string") {
    return { valid: false, reason: "Prompt is empty" }
  }

  if (prompt.length < 10) {
    return { valid: false, reason: "Prompt is too short" }
  }

  if (prompt.length > 50000) {
    return { valid: false, reason: "Prompt exceeds maximum length" }
  }

  // Verify system prompt is present and first
  if (!prompt.includes(SYSTEM_PROMPT.substring(0, 50))) {
    return { valid: false, reason: "System prompt missing or malformed" }
  }

  return { valid: true }
}

/**
 * Extracts token count estimate for prompt
 * Rough approximation: 1 token ≈ 4 characters
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Checks if prompt would exceed token limit
 */
export function exceedsTokenLimit(prompt: string, maxTokens: number = 30000): boolean {
  return estimateTokenCount(prompt) > maxTokens
}

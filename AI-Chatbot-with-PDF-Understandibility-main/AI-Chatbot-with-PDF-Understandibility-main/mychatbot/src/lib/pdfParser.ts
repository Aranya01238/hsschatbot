/**
 * Secure server-side PDF parsing module
 * Handles file validation, text extraction, sanitization, and chunking
 * 
 * Security measures:
 * - Validates file signature (PDF magic bytes)
 * - Enforces file size limits
 * - Sanitizes extracted text to prevent prompt injection
 * - Chunks large PDFs for token efficiency
 * - Strips control characters and suspicious patterns
 */

import { PDFParseResult } from "@/types/chat"

// PDF file signature (magic bytes)
const PDF_SIGNATURE = Buffer.from([0x25, 0x50, 0x44, 0x46]) // %PDF

// Security configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_EXTRACTION_LENGTH = 50000 // Max characters to extract
const MAX_PAGES_TO_PROCESS = 100
const MIN_PDF_SIZE = 10 // Minimum bytes for a valid PDF

/**
 * Validates PDF file before processing
 * Checks file signature, size, and basic structure
 */
function validatePDFFile(buffer: Buffer, filename: string): { valid: boolean; error?: string } {
  // Check file size
  if (buffer.length < MIN_PDF_SIZE) {
    return { valid: false, error: "File is too small to be a valid PDF" }
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` }
  }

  // Check PDF signature
  if (!buffer.slice(0, 4).equals(PDF_SIGNATURE)) {
    return { valid: false, error: "File is not a valid PDF (invalid signature)" }
  }

  // Check filename
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return { valid: false, error: "File must be a PDF (.pdf)" }
  }

  return { valid: true }
}

/**
 * Sanitizes extracted text to prevent prompt injection
 * - Removes control characters
 * - Strips suspicious patterns
 * - Limits whitespace
 */
function sanitizeExtractedText(text: string): string {
  if (!text || typeof text !== "string") return ""

  let sanitized = text
    // Remove null bytes and other control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Collapse multiple spaces/newlines
    .replace(/\s+/g, " ")
    // Remove suspicious patterns that could inject prompts
    .replace(/[\r\n]*(?:system|system prompt|ignore|forget|override)[\s:]*[\r\n]*/gi, "")
    .trim()

  // Truncate if too long
  if (sanitized.length > MAX_EXTRACTION_LENGTH) {
    sanitized = sanitized.substring(0, MAX_EXTRACTION_LENGTH) + "..."
  }

  return sanitized
}

/**
 * Dynamic import of pdf-parse to avoid CommonJS issues
 * Falls back to basic text extraction if unavailable
 */
async function getPDFParser() {
  try {
    // Try to import pdfjs-dist for server-side PDF parsing
    // This is more reliable than pdf.js in Node.js environment
    const pdfParse = await import("pdf-parse")
    return pdfParse.default
  } catch {
    // Fallback: if pdf-parse not available, return mock parser
    // In production, install: npm install pdf-parse
    return null
  }
}

/**
 * Extracts text from PDF buffer using server-side parsing
 * Uses pdf-parse library for reliable extraction
 * Falls back to basic regex extraction if parser unavailable
 */
async function extractTextFromPDF(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; pageCount: number }> {
  const pdfParse = await getPDFParser()

  if (pdfParse) {
    try {
      // Use pdf-parse for reliable extraction
      const data = await pdfParse(buffer)
      const pageCount = data.numpages || data.info?.Pages || 0
      const text = data.text || ""

      return {
        text: sanitizeExtractedText(text),
        pageCount: Math.min(pageCount, MAX_PAGES_TO_PROCESS),
      }
    } catch (error) {
      console.error("pdf-parse extraction failed, falling back to regex:", error)
    }
  }

  // Fallback: basic regex-based text extraction
  // This is a simplified approach; pdf-parse is strongly recommended
  const textContent = buffer.toString("binary")

  // Extract text between BT...ET markers (basic PDF text streams)
  const matches = textContent.match(/BT[\s\S]*?ET/g) || []
  const extractedText = matches
    .join(" ")
    .replace(/\(([^)]*)\)/g, "$1") // Extract text from parentheses
    .replace(/[^\w\s\d\n.,;:!?-]/g, "") // Keep only readable characters
    .substring(0, MAX_EXTRACTION_LENGTH)

  // Estimate page count from file markers
  const pageCount = (textContent.match(/\/Type[\s]*\/Page[^s]/g) || []).length || 1

  return {
    text: sanitizeExtractedText(extractedText || ""),
    pageCount: Math.min(pageCount, MAX_PAGES_TO_PROCESS),
  }
}

/**
 * Main PDF parsing function
 * Validates file, extracts text, sanitizes content
 * 
 * @param buffer - PDF file buffer
 * @param filename - Original filename for validation
 * @returns Parsed PDF result with error handling
 */
export async function parsePDF(buffer: Buffer, filename: string): Promise<PDFParseResult> {
  try {
    // Validate file
    const validation = validatePDFFile(buffer, filename)
    if (!validation.valid) {
      return {
        success: false,
        text: "",
        pageCount: 0,
        filename,
        error: validation.error,
        characterCount: 0,
      }
    }

    // Extract and sanitize text
    const { text, pageCount } = await extractTextFromPDF(buffer, filename)

    if (!text || text.length === 0) {
      return {
        success: false,
        text: "",
        pageCount,
        filename,
        error: "No readable text found in PDF",
        characterCount: 0,
      }
    }

    return {
      success: true,
      text,
      pageCount,
      filename,
      characterCount: text.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error during PDF parsing"
    console.error("PDF parsing error:", errorMessage)
    return {
      success: false,
      text: "",
      pageCount: 0,
      filename,
      error: `PDF parsing failed: ${errorMessage.substring(0, 100)}`,
      characterCount: 0,
    }
  }
}

/**
 * Chunks PDF text for token efficiency
 * Preserves semantic boundaries (paragraphs)
 * Used when PDF content is very large
 */
export function chunkPDFText(text: string, maxChunkSize: number = 3000, contextWindow: number = 500): string[] {
  if (!text || text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let currentChunk = ""

  // Split by paragraphs first to preserve semantics
  const paragraphs = text.split(/\n\s*\n+/)

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= maxChunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph
    } else {
      if (currentChunk) chunks.push(currentChunk)
      currentChunk = paragraph.substring(0, maxChunkSize)
    }
  }

  if (currentChunk) chunks.push(currentChunk)

  return chunks
}

/**
 * Extracts most relevant chunks of PDF text based on query
 * Simple keyword-based relevance matching
 */
export function extractRelevantContext(text: string, query: string, maxLength: number = 3000): string {
  if (!text) return ""

  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3)

  if (words.length === 0) {
    // No meaningful query words, return first chunk
    return text.substring(0, maxLength)
  }

  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

  // Score sentences by keyword matches
  const scoredSentences = sentences.map((sentence) => {
    const score = words.filter((word) => sentence.toLowerCase().includes(word)).length
    return { sentence: sentence.trim(), score }
  })

  // Select top sentences
  const relevant = scoredSentences.sort((a, b) => b.score - a.score).map((s) => s.sentence)

  let result = ""
  for (const sentence of relevant) {
    if ((result + sentence).length <= maxLength) {
      result += (result ? " " : "") + sentence
    } else {
      break
    }
  }

  return result || text.substring(0, maxLength)
}

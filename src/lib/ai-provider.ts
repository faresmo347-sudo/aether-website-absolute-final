/**
 * ═══════════════════════════════════════════════════════════
 * AETHER AI PROVIDER — Gemini primary, Groq fallback
 * ═══════════════════════════════════════════════════════════
 *
 * Every AI call in the app goes through callAI().
 * Smart switching logic:
 *   - Gemini Flash is primary (1M tokens/day free)
 *   - Groq llama-3.3-70b is fallback (100k tokens/day)
 *   - If Gemini rate-limits → switch to Groq for 60 min
 *   - When the timer expires → Gemini becomes primary again
 *   - If both fail → throw ALL_PROVIDERS_EXHAUSTED
 *
 * Server-side only. Never import in client components.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'

// ─────────────────────────────────────────────────────────
// MODULE-LEVEL STATE
// ─────────────────────────────────────────────────────────

/** Timestamp when Gemini can be retried after a rate limit. 0 = Gemini is available. */
let geminiFailedUntil: number = 0

/** How long to avoid Gemini after a 429 (default 60 minutes). */
const GEMINI_COOLDOWN_MS = 60 * 60 * 1000

// ─────────────────────────────────────────────────────────
// GEMINI CLIENT (singleton)
// ─────────────────────────────────────────────────────────

let geminiInstance: GoogleGenerativeAI | null = null

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiInstance) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('[Aether] GEMINI_API_KEY is not set in environment variables.')
    }
    geminiInstance = new GoogleGenerativeAI(apiKey)
  }
  return geminiInstance
}

// ─────────────────────────────────────────────────────────
// ERROR DETECTION
// ─────────────────────────────────────────────────────────

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as Record<string, unknown>

  // HTTP status codes
  if (err.status === 429 || err.statusCode === 429) return true

  // Nested error object
  if (err.error && typeof err.error === 'object') {
    const nested = err.error as Record<string, unknown>
    if (nested.status === 429 || nested.statusCode === 429) return true
  }

  // Message-based detection (covers both providers)
  const msg = String(err.message || '').toLowerCase()
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests') || msg.includes('resource_exhausted')) return true

  return false
}

// ─────────────────────────────────────────────────────────
// GEMINI CALL
// ─────────────────────────────────────────────────────────

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const genAI = getGeminiClient()

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
    systemInstruction: systemPrompt,
  })

  const result = await model.generateContent(userPrompt)
  const text = result.response.text()
  return text
}

// ─────────────────────────────────────────────────────────
// GROQ CALL
// ─────────────────────────────────────────────────────────

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const groq = getGroqClient()

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
  })

  return completion.choices[0]?.message?.content || ''
}

// ─────────────────────────────────────────────────────────
// MASTER callAI — THE ONLY FUNCTION ROUTES NEED
// ─────────────────────────────────────────────────────────

/**
 * Call the AI with automatic Gemini → Groq fallback.
 *
 * @param systemPrompt  The system instruction
 * @param userPrompt    The user message / prompt body
 * @param temperature   Sampling temperature (default 0.6)
 * @param maxTokens     Max output tokens (default 1024)
 * @returns Raw text response from whichever provider worked
 * @throws Error with message 'ALL_PROVIDERS_EXHAUSTED' if both fail
 */
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.6,
  maxTokens: number = 1024
): Promise<string> {
  // ──── Should we try Gemini? ────
  const geminiAvailable = Date.now() >= geminiFailedUntil

  if (geminiAvailable) {
    try {
      const text = await callGemini(systemPrompt, userPrompt, temperature, maxTokens)

      // Gemini worked — keep it primary
      geminiFailedUntil = 0
      console.log('[Aether] AI response from: Gemini')
      return text
    } catch (error) {
      if (isRateLimitError(error)) {
        // Gemini rate limited — set cooldown, fall through to Groq
        geminiFailedUntil = Date.now() + GEMINI_COOLDOWN_MS
        console.log('[Aether] Gemini rate limited, switching to Groq until', new Date(geminiFailedUntil).toISOString())
      } else {
        // Non-rate-limit error (bad key, network, etc.) — log and fall through
        console.error('[Aether] Gemini error (falling back to Groq):', error instanceof Error ? error.message : error)
      }
      // Fall through to Groq
    }
  }

  // ──── Groq fallback ────
  try {
    const text = await callGroq(systemPrompt, userPrompt, temperature, maxTokens)
    console.log('[Aether] AI response from: Groq fallback')
    // Do NOT reset geminiFailedUntil — keep waiting for Gemini to reset
    return text
  } catch (error) {
    if (isRateLimitError(error)) {
      console.error('[Aether] Groq rate limited too')
      throw new Error('ALL_PROVIDERS_EXHAUSTED')
    }

    console.error('[Aether] Groq error:', error instanceof Error ? error.message : error)
    throw new Error('ALL_PROVIDERS_EXHAUSTED')
  }
}

// ─────────────────────────────────────────────────────────
// callAIWithHistory — for chat routes that need history
// ─────────────────────────────────────────────────────────

/**
 * Call AI with multi-turn conversation history.
 * Flattens history + current message into a single user prompt
 * for maximum provider compatibility.
 */
export async function callAIWithHistory(
  systemPrompt: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentUserMessage: string,
  temperature: number = 0.6,
  maxTokens: number = 1024
): Promise<string> {
  // Build a combined user prompt with conversation context
  let userPrompt = ''

  if (chatHistory.length > 0) {
    const historyBlock = chatHistory
      .slice(-6) // Last 6 messages max
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Aether'}: ${msg.content}`)
      .join('\n')
    userPrompt = `RECENT CONVERSATION:\n${historyBlock}\n\n`
  }

  userPrompt += currentUserMessage

  return callAI(systemPrompt, userPrompt, temperature, maxTokens)
}

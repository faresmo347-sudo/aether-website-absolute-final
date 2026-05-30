import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'

interface MemoryData {
  id: string
  type: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  aiSummary?: string
  collectionId?: string
}

interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

interface AskResult {
  answer: string
  referencedIds: string[]
  sourcesCount: number
  detectedMode: 'memory-search' | 'conversation' | 'both'
  confidence: 'high' | 'medium' | 'low'
}

// ─────────────────────────────────────────────────────────
// 1. CONVERSATION vs MEMORY SEARCH DETECTION
// ─────────────────────────────────────────────────────────
// Patterns that signal the user wants to SEARCH their memories.
// If NONE of these match → it's a general conversation → ZERO memories sent.

const MEMORY_SEARCH_PATTERNS = [
  /\bdid i\b/i,
  /\bdo i\b/i,
  /\bhave i\b/i,
  /\bwas there\b/i,
  /\bwhen did\b/i,
  /\bwhere did\b/i,
  /\bhow did\b/i,
  /\bwho did\b/i,
  /\bwhat (was|were|did|is|about)\b/i,
  /\bfind\b/i,
  /\bshow me\b/i,
  /\brecall\b/i,
  /\bremember\b/i,
  /\bmemories? (about|of|for|on)\b/i,
  /\bnotes? (about|on)\b/i,
  /\bsaved\b/i,
  /\brecorded\b/i,
  /\bmentioned\b/i,
  /\bwrote (about|down)\b/i,
  /\bjotted\b/i,
  /\blogged\b/i,
  /\bcaptured\b/i,
  /\bstored\b/i,
  /\bkept\b/i,
  /\bbookmark\b/i,
  /\bany (note|memory|idea|thought)s? (about|on)\b/i,
  /\bwhat (i |we )(save|thought|said|wrote|mentioned|read|heard|saw)\b/i,
  /\btell me (about |what )?(i |we )?(save|thought|said|wrote|mentioned)\b/i,
]

/**
 * Returns true if the question looks like the user is trying to
 * find/recall something from their saved memories.
 */
function isMemorySearch(question: string): boolean {
  return MEMORY_SEARCH_PATTERNS.some((p) => p.test(question))
}

// ─────────────────────────────────────────────────────────
// 2. SMART MEMORY FILTERING (no embeddings, no new APIs)
// ─────────────────────────────────────────────────────────
// For memory-search questions:
//   - Take the 15 most recent memories
//   - PLUS any memories whose title or tags contain words from the question
//   - Cap the content of each memory at 200 characters for Groq

const CONTENT_CAP = 200

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'about', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'and', 'but', 'or', 'if', 'while',
  'did', 'was', 'were', 'had', 'been', 'does', 'any', 'some', 'much',
  'many', 'own', 'also', 'even', 'still', 'already', 'yet', 'just',
])

/**
 * Extract meaningful keywords from the question for matching.
 */
function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

/**
 * Smart memory filter:
 * 1. Sort all memories by recency
 * 2. Take the 15 most recent
 * 3. Also find memories where title or tags contain question keywords
 * 4. Merge and deduplicate
 * Returns slim memories (content capped at CONTENT_CAP chars).
 */
function smartFilterMemories(memories: MemoryData[], question: string): MemoryData[] {
  const keywords = extractKeywords(question)

  // Sort by recency (newest first)
  const sorted = [...memories].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // 15 most recent
  const recentIds = new Set<string>()
  const recent = sorted.slice(0, 15)
  for (const m of recent) {
    recentIds.add(m.id)
  }

  // Keyword-matched memories (title or tags contain question words)
  const matched: MemoryData[] = []
  if (keywords.length > 0) {
    for (const m of memories) {
      if (recentIds.has(m.id)) continue // already included

      const titleLower = m.title.toLowerCase()
      const tagsLower = m.tags.map((t) => t.toLowerCase()).join(' ')
      const searchable = `${titleLower} ${tagsLower}`

      const hasMatch = keywords.some((kw) => searchable.includes(kw))
      if (hasMatch) {
        matched.push(m)
      }
    }
  }

  // Merge: recent first, then keyword matches
  const combined = [...recent, ...matched]

  // Slim down: cap content at CONTENT_CAP chars
  return combined.map((m) => ({
    ...m,
    content: m.content.slice(0, CONTENT_CAP),
    aiSummary: m.aiSummary ? m.aiSummary.slice(0, 100) : undefined,
  }))
}

// ─────────────────────────────────────────────────────────
// 3. CONVERSATION-ONLY PROMPT (zero memories sent)
// ─────────────────────────────────────────────────────────

function buildConversationPrompt(question: string, conversationContext: string): string {
  return `This is a GENERAL CONVERSATION — the user is NOT searching their memories. Talk to them warmly as Aether.

${conversationContext}
The user just said: "${question}"

RULES:
- Have a warm, natural conversation. Answer questions using your general knowledge.
- If they're venting or sharing feelings, support them warmly.
- If they ask a factual question, answer it accurately.
- NEVER say "I couldn't find a memory about that" — you're chatting, not searching.
- ONLY suggest saving memories if it naturally fits the conversation.
- Keep responses concise and friendly.

Respond with JSON:
{
  "answer": "Your warm response",
  "referencedIds": [],
  "sourcesCount": 0,
  "detectedMode": "conversation",
  "confidence": "high"
}`
}

// ─────────────────────────────────────────────────────────
// 4. MEMORY SEARCH PROMPT (slim memories sent)
// ─────────────────────────────────────────────────────────

function buildMemorySearchPrompt(
  filteredMemories: MemoryData[],
  totalMemories: number,
  question: string,
  conversationContext: string
): string {
  // Format slim memories for the LLM context
  const memoriesContext = filteredMemories
    .map((m) => {
      const date = new Date(m.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      return `[ID: ${m.id}] [${m.type}] [${date}] "${m.title}" — ${m.content} Tags: ${m.tags.join(', ')}`
    })
    .join('\n')

  return `The user has ${totalMemories} total memories. Here are the ${filteredMemories.length} most relevant ones:

${memoriesContext}
${conversationContext}
═══
The user just said: "${question}"
═══

IMPORTANT — ACCURACY FIRST:
- You MUST ONLY reference memories that appear in the list above. Do NOT invent or assume memory content.
- QUOTE exact titles and content from the memories rather than paraphrasing.
- If you find relevant memories, include their exact IDs in referencedIds.
- If NO memories match the user's query, say so honestly — do NOT fabricate or hallucinate memory content.
- Search THOROUGHLY through ALL the provided memories before responding.

CRITICAL — CONVERSATION vs MEMORY SEARCH:
- If the user is just talking or venting → JUST TALK to them warmly. Do NOT mention memories.
- ONLY reference memories if the user EXPLICITLY asks about their saved memories.
- When in doubt → just have a conversation.

CONVERSATION AWARENESS:
- If the user refers to something you said earlier, CONTINUE that conversation naturally.
- If they say "that one", "tell me more" — they're referring to something from the conversation above.

RESPOND with JSON:
{
  "answer": "Your response",
  "referencedIds": ["id1", "id2"],
  "sourcesCount": 2,
  "detectedMode": "memory-search" | "conversation" | "both",
  "confidence": "high" | "medium" | "low"
}`
}

// ─────────────────────────────────────────────────────────
// 429 RATE LIMIT HANDLER
// ─────────────────────────────────────────────────────────

const RATE_LIMIT_MESSAGE = "I need a moment to rest — my thinking limit has been reached for now. Try again in a little while!"

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as Record<string, unknown>
  // Groq SDK throws errors with status property
  if (err.status === 429) return true
  if (err.statusCode === 429) return true
  // Check nested error
  if (err.error && typeof err.error === 'object') {
    const nested = err.error as Record<string, unknown>
    if (nested.status === 429 || nested.statusCode === 429) return true
  }
  // Check message string
  const msg = String(err.message || '').toLowerCase()
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) return true
  return false
}

// ─────────────────────────────────────────────────────────
// CALL GROQ WITH RATE-LIMIT AWARENESS
// ─────────────────────────────────────────────────────────

async function callGroq(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxRetries = 1
): Promise<string> {
  const groq = getGroqClient()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 1024, // Reduced from 2048 — answers don't need that much
      })
      return completion.choices[0]?.message?.content || ''
    } catch (error) {
      if (isRateLimitError(error) && attempt < maxRetries) {
        // Wait 2s before retry on rate limit
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}

// ─────────────────────────────────────────────────────────
// MAIN ASK ROUTE
// ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { question, memories, chatHistory } = (await req.json()) as {
      question: string
      memories: MemoryData[]
      chatHistory?: ChatHistoryItem[]
    }

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Build conversation context from chat history (if provided)
    const hasHistory = chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0
    const conversationContext = hasHistory
      ? `\nRECENT CONVERSATION:\n${chatHistory!
          .slice(-6) // Reduced from 10 to 6 — less token waste
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Aether'}: ${msg.content}`)
          .join('\n')}\n`
      : ''

    // Build messages array — shared between both paths
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: AETHER_MASTER_PROMPT },
    ]

    // Include chat history as conversation messages
    if (hasHistory) {
      for (const msg of chatHistory!.slice(-6)) { // Reduced from 8 to 6
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })
      }
    }

    // ──── DECISION: Conversation-only or Memory Search? ────
    const noMemories = !memories || !Array.isArray(memories) || memories.length === 0
    const isSearch = !noMemories && isMemorySearch(question)

    if (!isSearch) {
      // ═══════ CONVERSATION PATH: ZERO memories sent to Groq ═══════
      const prompt = buildConversationPrompt(question, conversationContext)
      messages.push({ role: 'user', content: prompt })

      const responseText = await callGroq(messages)
      const result = parseAIResponse(responseText)

      if (!result || !result.answer) {
        return NextResponse.json({
          answer: "Hey! I'd love to chat with you. What's on your mind?",
          referencedIds: [],
          sourcesCount: 0,
          detectedMode: 'conversation',
          confidence: 'high',
        })
      }

      result.referencedIds = []
      result.sourcesCount = 0
      result.detectedMode = 'conversation'
      result.confidence = result.confidence || 'high'

      return NextResponse.json(result)
    }

    // ═══════ MEMORY SEARCH PATH: Slim filtered memories sent ═══════
    const filteredMemories = smartFilterMemories(memories, question)
    const prompt = buildMemorySearchPrompt(
      filteredMemories,
      memories.length,
      question,
      conversationContext
    )
    messages.push({ role: 'user', content: prompt })

    const responseText = await callGroq(messages)

    // Parse the JSON response with fallback
    let result = parseAIResponse(responseText)

    if (!result || !result.answer) {
      const fallbackAnswer = responseText
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .replace(/^\s*\{[\s\S]*\}\s*$/g, '')
        .trim()

      result = {
        answer: fallbackAnswer || "I couldn't find anything about that in your memories — it might not be saved yet. Could you try rephrasing your question?",
        referencedIds: [],
        sourcesCount: 0,
        detectedMode: 'conversation' as const,
        confidence: 'low' as const,
      }
    }

    // Validate referencedIds exist in the provided memories (use ALL memories, not just filtered)
    const memoryIds = new Set(memories.map((m) => m.id))
    if (Array.isArray(result.referencedIds)) {
      result.referencedIds = (result.referencedIds as string[]).filter((id) => memoryIds.has(id))
    } else {
      result.referencedIds = []
    }

    result.sourcesCount = result.referencedIds.length

    // Validate detectedMode
    const validModes: string[] = ['memory-search', 'conversation', 'both']
    const detectedMode = String(result.detectedMode || '')
    if (!detectedMode || !validModes.includes(detectedMode)) {
      if (result.referencedIds.length > 0 && result.answer.length > 0) {
        result.detectedMode = 'both'
      } else if (result.referencedIds.length > 0) {
        result.detectedMode = 'memory-search'
      } else {
        result.detectedMode = 'conversation'
      }
    } else {
      result.detectedMode = detectedMode as AskResult['detectedMode']
    }

    // Validate confidence
    const validConfidences: string[] = ['high', 'medium', 'low']
    const confidence = String(result.confidence || '')
    if (!confidence || !validConfidences.includes(confidence)) {
      result.confidence = result.referencedIds.length > 0 ? 'medium' : 'high'
    } else {
      result.confidence = confidence as AskResult['confidence']
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI ask error:', error)

    // 429 rate limit — warm message, never raw error
    if (isRateLimitError(error)) {
      return NextResponse.json({
        answer: RATE_LIMIT_MESSAGE,
        referencedIds: [],
        sourcesCount: 0,
        detectedMode: 'conversation',
        confidence: 'low',
      })
    }

    return NextResponse.json({
      answer: "I had trouble searching your memories right now. Please try again — I'm here for you.",
      referencedIds: [],
      sourcesCount: 0,
      detectedMode: 'conversation',
      confidence: 'low',
    })
  }
}

/**
 * Parse the AI response text into a JSON object.
 * Tries multiple strategies to extract valid JSON.
 */
function parseAIResponse(responseText: string): AskResult | null {
  if (!responseText) return null

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as AskResult
      // Ensure required fields exist
      if (typeof parsed.answer === 'string') return parsed
      return null
    } catch {
      try {
        const cleaned = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/'/g, '"')
        const parsed = JSON.parse(cleaned) as AskResult
        if (typeof parsed.answer === 'string') return parsed
        return null
      } catch {
        const answerMatch = responseText.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/)
        if (answerMatch) {
          return {
            answer: answerMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
            referencedIds: [],
            sourcesCount: 0,
            detectedMode: 'conversation',
            confidence: 'low',
          }
        }
      }
    }
  }

  return null
}

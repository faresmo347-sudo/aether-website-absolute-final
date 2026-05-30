import { NextRequest, NextResponse } from 'next/server'
import { callAI, callAIWithHistory } from '@/lib/ai-provider'
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
// CONVERSATION vs MEMORY SEARCH DETECTION
// ─────────────────────────────────────────────────────────

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

function isMemorySearch(question: string): boolean {
  return MEMORY_SEARCH_PATTERNS.some((p) => p.test(question))
}

// ─────────────────────────────────────────────────────────
// SMART MEMORY FILTERING
// ─────────────────────────────────────────────────────────

const CONTENT_CAP = 300

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

function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

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

  // Keyword-matched memories (title, tags, or content contain question words)
  const matched: MemoryData[] = []
  if (keywords.length > 0) {
    for (const m of memories) {
      if (recentIds.has(m.id)) continue

      const titleLower = m.title.toLowerCase()
      const tagsLower = m.tags.map((t) => t.toLowerCase()).join(' ')
      const contentLower = m.content.toLowerCase()
      const searchable = `${titleLower} ${tagsLower} ${contentLower}`

      const hasMatch = keywords.some((kw) => searchable.includes(kw))
      if (hasMatch) {
        matched.push(m)
      }
    }
  }

  // Merge: recent first, then keyword matches — cap at 20 total
  const combined = [...recent, ...matched].slice(0, 20)

  // Slim down: cap content at CONTENT_CAP chars
  return combined.map((m) => ({
    ...m,
    content: m.content.slice(0, CONTENT_CAP),
    aiSummary: m.aiSummary ? m.aiSummary.slice(0, 100) : undefined,
  }))
}

// ─────────────────────────────────────────────────────────
// PROMPT BUILDERS
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

function buildMemorySearchPrompt(
  filteredMemories: MemoryData[],
  totalMemories: number,
  question: string,
  conversationContext: string
): string {
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

    // Build conversation context from chat history
    const hasHistory = chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0
    const conversationContext = hasHistory
      ? `\nRECENT CONVERSATION:\n${chatHistory!
          .slice(-6)
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Aether'}: ${msg.content}`)
          .join('\n')}\n`
      : ''

    // ──── DECISION: Conversation-only or Memory Search? ────
    const noMemories = !memories || !Array.isArray(memories) || memories.length === 0
    const isSearch = !noMemories && isMemorySearch(question)

    let responseText: string

    if (!isSearch) {
      // ═══════ CONVERSATION PATH: ZERO memories sent ═══════
      const userPrompt = buildConversationPrompt(question, conversationContext)
      responseText = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.6, 1024)
    } else {
      // ═══════ MEMORY SEARCH PATH: Slim filtered memories ═══════
      const filteredMemories = smartFilterMemories(memories, question)
      const userPrompt = buildMemorySearchPrompt(
        filteredMemories,
        memories.length,
        question,
        conversationContext
      )
      responseText = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.3, 1024)
    }

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

    // For conversation path, always reset these
    if (!isSearch) {
      result.referencedIds = []
      result.sourcesCount = 0
      result.detectedMode = 'conversation'
      result.confidence = result.confidence || 'high'
    } else {
      // Validate referencedIds exist in the provided memories
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
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI ask error:', error)

    // ALL_PROVIDERS_EXHAUSTED — both Gemini and Groq are down
    if (error instanceof Error && error.message === 'ALL_PROVIDERS_EXHAUSTED') {
      return NextResponse.json({
        answer: "I need a little rest right now — both my thinking engines are taking a short break. Try again in about an hour and I'll be fully back for you! 💜",
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

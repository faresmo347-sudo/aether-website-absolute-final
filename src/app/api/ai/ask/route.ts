import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'
import { generateEmbedding, isZeroVector } from '@/lib/embeddings'
import { semanticSearchMemories } from '@/lib/supabase/data'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

// ─────────────────────────────────────────────────────────
// KEYWORD-BASED FALLBACK (used when semantic search fails)
// ─────────────────────────────────────────────────────────

function scoreMemoryRelevance(memory: MemoryData, queryWords: string[]): number {
  const searchable = [
    memory.title,
    memory.content,
    memory.tags.join(' '),
    memory.aiSummary || '',
  ].join(' ').toLowerCase()

  let score = 0
  for (const word of queryWords) {
    if (word.length < 2) continue
    const wordRegex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i')
    if (wordRegex.test(searchable)) {
      score += 3
    } else if (searchable.includes(word.toLowerCase())) {
      score += 1
    }
  }

  const titleLower = memory.title.toLowerCase()
  for (const word of queryWords) {
    if (word.length < 2) continue
    if (titleLower.includes(word.toLowerCase())) {
      score += 2
    }
  }

  return score
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function preFilterMemories(memories: MemoryData[], question: string, maxResults = 10): MemoryData[] {
  if (memories.length <= maxResults) return memories

  const queryWords = question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))

  if (queryWords.length === 0) {
    return memories.slice(0, maxResults)
  }

  const scored = memories.map((m) => ({
    memory: m,
    score: scoreMemoryRelevance(m, queryWords),
  }))

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(b.memory.createdAt).getTime() - new Date(a.memory.createdAt).getTime()
  })

  const topScored = scored.slice(0, maxResults)

  const withScore = topScored.filter((s) => s.score > 0)
  if (withScore.length >= 3) {
    return withScore.map((s) => s.memory)
  }

  return topScored.map((s) => s.memory)
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
])

// ─────────────────────────────────────────────────────────
// SEMANTIC SEARCH: Try pgvector first, fall back to keyword
// ─────────────────────────────────────────────────────────

/**
 * Attempt semantic search using pgvector embeddings.
 * Returns the matched memories or null if semantic search is unavailable.
 */
async function trySemanticSearch(
  question: string,
  clientMemories: MemoryData[]
): Promise<{ memories: MemoryData[]; source: 'semantic' | 'keyword' } | null> {
  // Step 1: Generate embedding for the question
  const queryEmbedding = await generateEmbedding(question)

  // If embedding generation failed (zero vector), skip semantic search
  if (isZeroVector(queryEmbedding)) {
    return null
  }

  // Step 2: Get the authenticated user ID for the Supabase query
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Not authenticated — can't use server-side semantic search
      // Fall back to client-side keyword filtering
      return null
    }

    // Step 3: Call the match_memories RPC function
    const matched = await semanticSearchMemories(user.id, queryEmbedding, 10, 0.25)

    if (matched.length > 0) {
      // Convert the Supabase Memory objects back to MemoryData format
      const semanticMemories: MemoryData[] = matched.map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        content: m.content,
        tags: m.tags,
        createdAt: m.createdAt,
        aiSummary: m.aiSummary,
        collectionId: m.collectionId,
      }))

      return { memories: semanticMemories, source: 'semantic' }
    }

    // Semantic search returned 0 results — could mean:
    // 1. No memories have embeddings yet (need backfill)
    // 2. No memories match the threshold
    // Fall back to keyword search
    return null
  } catch (error) {
    console.warn('[Aether] Semantic search error, falling back to keyword:', error)
    return null
  }
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
      ? `\nRECENT CONVERSATION (what you and the user have been talking about):\n${chatHistory!
          .slice(-10)
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Aether'}: ${msg.content}`)
          .join('\n')}\n`
      : ''

    // Handle the case where there are no memories — the AI can still have a conversation
    if (!memories || !Array.isArray(memories) || memories.length === 0) {
      const groq = getGroqClient()

      const noMemoryPrompt = `The user has no saved memories yet.${conversationContext}
The user just said: "${question}"

Since they have no memories, this is a GENERAL CONVERSATION. Talk to them warmly as Aether — their memory companion. You can:
- Answer their question conversationally using your general knowledge
- If they're referring to something you said earlier, continue that conversation naturally
- If they ask a factual question, answer it accurately
- If they're venting or sharing feelings, support them warmly
- ONLY suggest saving memories if it naturally fits the conversation
- NEVER say "I couldn't find a memory about that" — you're having a conversation, not searching
- Just be a good companion and chat with them

Respond with JSON:
{
  "answer": "Your warm response",
  "referencedIds": [],
  "sourcesCount": 0,
  "detectedMode": "conversation",
  "confidence": "high"
}`

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: AETHER_MASTER_PROMPT },
      ]

      if (hasHistory) {
        for (const msg of chatHistory!.slice(-8)) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          })
        }
      }

      messages.push({ role: 'user', content: noMemoryPrompt })

      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      })

      const responseText = completion.choices[0]?.message?.content || ''
      const result = parseAIResponse(responseText)

      if (!result || !result.answer) {
        return NextResponse.json({
          answer: "Hey! I'd love to chat with you. Once you start saving some memories, I'll be able to help you find them too!",
          referencedIds: [],
          sourcesCount: 0,
          detectedMode: 'conversation',
          confidence: 'high',
        })
      }

      result.referencedIds = []
      result.sourcesCount = 0
      result.detectedMode = result.detectedMode || 'conversation'
      result.confidence = result.confidence || 'high'

      return NextResponse.json(result)
    }

    // ──── SEMANTIC SEARCH (primary) with KEYWORD FALLBACK ────
    let filteredMemories: MemoryData[]
    let searchMethod: 'semantic' | 'keyword' = 'keyword'

    const semanticResult = await trySemanticSearch(question, memories)

    if (semanticResult) {
      // Semantic search returned results — use them
      filteredMemories = semanticResult.memories
      searchMethod = semanticResult.source
    } else {
      // Semantic search unavailable or returned 0 results — fall back to keyword pre-filter
      filteredMemories = preFilterMemories(memories, question, 10)
      searchMethod = 'keyword'
    }

    const groq = getGroqClient()

    // Format memories for the LLM context
    const memoriesContext = filteredMemories
      .map((m) => {
        const date = new Date(m.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const contentPrefix = m.type === 'image' ? '[IMAGE - Full Text Extracted]: ' : ''
        return `[ID: ${m.id}] [${m.type}] [${date}] "${m.title}" — ${contentPrefix}${m.content}${m.aiSummary ? ` (AI Summary: ${m.aiSummary})` : ''} Tags: ${m.tags.join(', ')}`
      })
      .join('\n')

    const searchLabel = searchMethod === 'semantic'
      ? 'semantic similarity search (embeddings + cosine similarity)'
      : 'keyword relevance scoring'

    const userPrompt = `The user has ${memories.length} total memories. Using ${searchLabel}, I found the ${filteredMemories.length} most relevant ones:

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
- If you're unsure whether a memory is relevant, include it and set confidence to "medium" or "low".
- Search THOROUGHLY through ALL the provided memories before responding — don't stop at the first match.
- If the query is vague, use FUZZY MATCHING — check for partial matches in title, content, tags, and AI summary.

CRITICAL — CONVERSATION vs MEMORY SEARCH:
- If the user is just talking, venting, asking a general question, or expressing feelings → JUST TALK to them warmly. Do NOT search memories. Do NOT say "I couldn't find a memory about that."
- ONLY search and reference memories if the user EXPLICITLY asks about their saved memories (e.g., "what did I save about X?", "show me my notes on Y", "did I mention Z?")
- When in doubt → just have a conversation. It's better to chat than to inappropriately search memories.

IMPORTANT — CONVERSATION AWARENESS:
- If the user is referring to something you (Aether) said in a previous message, CONTINUE that conversation naturally. Don't start from scratch.
- If the user says "that one", "the second one", "tell me more about it", "what about the other one", etc. — they are referring to something from the conversation above. Look at what was discussed and respond accordingly.
- If the user asks a follow-up question about a memory you referenced, provide MORE details about that specific memory.

STEP 1 — DETECT THE MODE:
Read the user's message carefully AND consider the conversation context:
- Is this a MEMORY SEARCH? (they EXPLICITLY ask to find/recall something they saved — "what did I save about X", "show me my notes on Y")
- Is this a GENERAL CONVERSATION? (they want to talk, vent, think out loud, or ask a general question — NOT about their saved memories)
- Is it BOTH? (they're chatting AND explicitly asking to find something they saved)
- Is this a FOLLOW-UP to the conversation? (referring to something you said or a memory you referenced)
- WHEN IN DOUBT → CONVERSATION. Default to chatting unless they explicitly ask about their memories.

STEP 2 — RESPOND AS AETHER:
- If FOLLOW-UP: Continue the conversation naturally, referencing what was already discussed. Don't repeat yourself unnecessarily.
- If MEMORY SEARCH: Search through their memories carefully. Reference specific dates, titles, and content. Put relevant IDs in referencedIds. QUOTE exact content.
- If CONVERSATION: Talk to them like a warm friend. Use your knowledge. Answer questions. Give advice. Support them. Do NOT mention memories. referencedIds should be [].
- If BOTH: Start conversationally, then naturally bring in relevant memories. Put referenced IDs in referencedIds.

STEP 3 — SET CONFIDENCE:
- "high" if you found clear, direct memory matches and are quoting exact content
- "medium" if you found partial/fuzzy matches or the connection is indirect
- "low" if you found no clear matches and are making your best guess
- Use "high" for pure conversation mode

STEP 4 — SET THE MODE:
Include "detectedMode" in your JSON response: "memory-search", "conversation", or "both"

ALWAYS respond with the JSON format specified in your system instructions.`

    // Build messages array with system prompt, chat history, and current question
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: AETHER_MASTER_PROMPT },
    ]

    // Include chat history as actual conversation messages so the model understands context
    if (hasHistory) {
      for (const msg of chatHistory!.slice(-8)) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })
      }
    }

    messages.push({ role: 'user', content: userPrompt })

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    })

    const responseText = completion.choices[0]?.message?.content || ''

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
      result.referencedIds = result.referencedIds.filter((id: string) => memoryIds.has(id))
    } else {
      result.referencedIds = []
    }

    result.sourcesCount = result.referencedIds.length

    // Validate detectedMode
    const validModes = ['memory-search', 'conversation', 'both']
    if (!result.detectedMode || !validModes.includes(result.detectedMode)) {
      if (result.referencedIds.length > 0 && result.answer.length > 0) {
        result.detectedMode = 'both'
      } else if (result.referencedIds.length > 0) {
        result.detectedMode = 'memory-search'
      } else {
        result.detectedMode = 'conversation'
      }
    }

    // Validate confidence
    const validConfidences = ['high', 'medium', 'low']
    if (!result.confidence || !validConfidences.includes(result.confidence)) {
      if (result.referencedIds.length > 0) {
        result.confidence = 'medium'
      } else {
        result.confidence = 'high'
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI ask error:', error)
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
function parseAIResponse(responseText: string): Record<string, unknown> | null {
  if (!responseText) return null

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      try {
        const cleaned = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/'/g, '"')
        return JSON.parse(cleaned)
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

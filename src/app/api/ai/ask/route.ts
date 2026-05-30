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

/**
 * Score a memory's relevance to a query by counting how many query words
 * appear in its searchable fields (title, content, tags, aiSummary).
 * Uses case-insensitive matching and also checks partial word boundaries.
 */
function scoreMemoryRelevance(memory: MemoryData, queryWords: string[]): number {
  const searchable = [
    memory.title,
    memory.content,
    memory.tags.join(' '),
    memory.aiSummary || '',
  ].join(' ').toLowerCase()

  let score = 0
  for (const word of queryWords) {
    if (word.length < 2) continue // Skip tiny words
    // Full word match gets higher weight
    const wordRegex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i')
    if (wordRegex.test(searchable)) {
      score += 3
    } else if (searchable.includes(word.toLowerCase())) {
      // Partial match (substring) gets lower weight
      score += 1
    }
  }

  // Bonus: if the title matches, it's extra relevant
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

/**
 * Pre-filter memories by relevance to reduce noise sent to the LLM.
 * Returns the top N most relevant memories, or all if there are few.
 */
function preFilterMemories(memories: MemoryData[], question: string, maxResults = 18): MemoryData[] {
  if (memories.length <= maxResults) return memories

  const queryWords = question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))

  // If no meaningful query words after filtering, return all memories (up to max)
  if (queryWords.length === 0) {
    return memories.slice(0, maxResults)
  }

  // Score each memory
  const scored = memories.map((m) => ({
    memory: m,
    score: scoreMemoryRelevance(m, queryWords),
  }))

  // Sort by score descending, then by date (newer first) for ties
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(b.memory.createdAt).getTime() - new Date(a.memory.createdAt).getTime()
  })

  // Take top results, but always include at least some with score > 0 if they exist
  const topScored = scored.slice(0, maxResults)

  // If we have memories with score > 0, filter out zeros but keep at least 5 for context
  const withScore = topScored.filter((s) => s.score > 0)
  if (withScore.length >= 5) {
    return withScore.map((s) => s.memory)
  }

  // Otherwise return all top N (even zeros) so the AI has some context
  return topScored.map((s) => s.memory)
}

// Common stop words to ignore during relevance scoring
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
          .slice(-10) // Last 10 messages max
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Aether'}: ${msg.content}`)
          .join('\n')}\n`
      : ''

    // Handle the case where there are no memories — the AI can still have a conversation
    if (!memories || !Array.isArray(memories) || memories.length === 0) {
      const groq = getGroqClient()

      const noMemoryPrompt = `The user has no saved memories yet.${conversationContext}
The user just said: "${question}"

Since they have no memories, this is a GENERAL CONVERSATION. Talk to them warmly as Aether — their memory companion. You can:
- Answer their question conversationally
- If they're referring to something you said earlier, continue that conversation naturally
- Suggest they start saving memories so you can help them find things later
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

      // Include chat history as actual conversation messages for better context
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
        temperature: 0.6,
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

    // Pre-filter memories by relevance to reduce noise
    const filteredMemories = preFilterMemories(memories, question, 18)

    const groq = getGroqClient()

    // Format memories for the LLM context — image memories get special prefix for searchability
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

    const userPrompt = `The user has ${filteredMemories.length} saved memories (pre-filtered from ${memories.length} total by relevance). Here they are:

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

IMPORTANT — CONVERSATION AWARENESS:
- If the user is referring to something you (Aether) said in a previous message, CONTINUE that conversation naturally. Don't start from scratch.
- If the user says "that one", "the second one", "tell me more about it", "what about the other one", etc. — they are referring to something from the conversation above. Look at what was discussed and respond accordingly.
- If the user asks a follow-up question about a memory you referenced, provide MORE details about that specific memory.
- You can naturally flow between searching memories and having a conversation — the user doesn't need to explicitly ask for one or the other.

STEP 1 — DETECT THE MODE:
Read the user's message carefully AND consider the conversation context:
- Is this a MEMORY SEARCH? (they want to find/recall something they saved)
- Is this a GENERAL CONVERSATION? (they want to talk, vent, think out loud, or ask a general question)
- Is it BOTH? (they're chatting AND want to find something)
- Is this a FOLLOW-UP to the conversation? (referring to something you said or a memory you referenced)

STEP 2 — RESPOND AS AETHER:
- If FOLLOW-UP: Continue the conversation naturally, referencing what was already discussed. Don't repeat yourself unnecessarily.
- If MEMORY SEARCH: Search through their memories carefully. Reference specific dates, titles, and content. Put relevant IDs in referencedIds. QUOTE exact content.
- If CONVERSATION: Talk to them like a warm friend. Listen, support, advise. Only reference a memory if it naturally fits. referencedIds should be [].
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
      temperature: 0.6,
      max_tokens: 2048,
    })

    const responseText = completion.choices[0]?.message?.content || ''

    // Parse the JSON response with fallback
    let result = parseAIResponse(responseText)

    if (!result || !result.answer) {
      // Fallback: try to extract any readable text as the answer
      const fallbackAnswer = responseText
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .replace(/^\s*\{[\s\S]*\}\s*$/g, '') // Try to strip JSON
        .trim()

      result = {
        answer: fallbackAnswer || "I looked through your memories but couldn't find a clear match for your question. Could you try rephrasing it?",
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

    // Validate detectedMode — ensure it's one of the allowed values
    const validModes = ['memory-search', 'conversation', 'both']
    if (!result.detectedMode || !validModes.includes(result.detectedMode)) {
      // Infer mode from referencedIds
      if (result.referencedIds.length > 0 && result.answer.length > 0) {
        result.detectedMode = 'both'
      } else if (result.referencedIds.length > 0) {
        result.detectedMode = 'memory-search'
      } else {
        result.detectedMode = 'conversation'
      }
    }

    // Validate confidence — ensure it's one of the allowed values
    const validConfidences = ['high', 'medium', 'low']
    if (!result.confidence || !validConfidences.includes(result.confidence)) {
      // Infer confidence: if no memories referenced but answer exists, it's conversation (high)
      // If memories referenced, default to medium
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
      answer: 'Sorry, I had trouble searching your memories. Please try again.',
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

  // Strategy 1: Find a JSON block in the response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Strategy 2: Try to fix common JSON issues (trailing commas, etc.)
      try {
        const cleaned = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
          .replace(/'/g, '"') // Replace single quotes with double quotes
        return JSON.parse(cleaned)
      } catch {
        // Strategy 3: Try to extract just the "answer" field value as a fallback
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

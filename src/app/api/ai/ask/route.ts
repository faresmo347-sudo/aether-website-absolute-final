import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'
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

interface AskResult {
  answer: string
  referencedIds: string[]
  detectedMode: 'memory-search' | 'conversation' | 'both'
  confidence: 'high' | 'medium' | 'low'
}

// ─────────────────────────────────────────────────────────
// CONVERSATION vs MEMORY SEARCH DETECTION
// ─────────────────────────────────────────────────────────

const MEMORY_SEARCH_TERMS = [
  'did i', 'when did', 'find', 'show me', 'remember when',
  'what was', 'search', 'look for', 'i saved', 'who was',
  'where did', 'what did', 'remind me', 'that thing',
  'that place', 'that book', 'that cafe', 'that restaurant',
  'that idea', 'that person', 'that note', 'last time',
  'few weeks', 'last month', 'last week', 'back in',
  'a while ago', 'recently', 'do i have', 'have i',
  'was there', 'recall', 'memories about', 'notes about',
  'saved', 'recorded', 'mentioned', 'captured', 'stored',
  'bookmark', 'jotted', 'logged',
]

function isMemorySearch(question: string): boolean {
  const lower = question.toLowerCase()
  return MEMORY_SEARCH_TERMS.some((term) => lower.includes(term))
}

// ─────────────────────────────────────────────────────────
// PROMPT BUILDERS
// ─────────────────────────────────────────────────────────

function buildConversationPrompt(
  question: string,
  conversationContext: string,
  userContext: string
): string {
  return `${userContext}This is JUST CHATTING — the user is NOT searching their memories. Talk to them like a warm best friend.

${conversationContext}
The user just said: "${question}"

RULES:
- Be a great friend. Answer naturally. Be warm and present.
- If they're venting or sharing feelings, support them warmly — acknowledge the feeling FIRST.
- If they ask a factual question, answer it casually and accurately.
- NEVER say "I couldn't find a memory about that" — you're chatting, not searching.
- NEVER mention memories unless the user explicitly asked about something they saved.
- Keep it short — 2-4 sentences max unless they asked for something detailed.
- Use contractions always. Sound human, not corporate.
- Use an emoji if it fits naturally but don't force it.
- End with a gentle follow-up question sometimes, but not always.

Respond with JSON:
{
  "answer": "Your warm natural response",
  "referencedIds": []
}`
}

function buildMemorySearchPrompt(
  allMemories: MemoryData[],
  question: string,
  conversationContext: string,
  userContext: string
): string {
  // Format ALL memories with maximum context — image memories get FULL content, others trimmed to 400 chars
  const memoriesContext = allMemories
    .map((m) => {
      const formattedDate = new Date(m.createdAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      if (m.type === 'image') {
        return `[MEMORY ID: ${m.id}]
TYPE: Image memory (text extracted from photo)
DATE: ${formattedDate}
TITLE: ${m.title || 'Untitled image'}
EXTRACTED TEXT FROM IMAGE:
${m.content || 'No text extracted'}
TAGS: ${(m.tags || []).join(', ')}
AI SUMMARY: ${m.aiSummary || ''}`
      }
      return `[ID: ${m.id}]
Type: ${m.type}
Date: ${formattedDate}
Title: ${m.title || 'Untitled'}
Content: ${(m.content || '').slice(0, 400)}
Tags: ${(m.tags || []).join(', ')}
Summary: ${m.aiSummary || ''}`
    })
    .join('\n\n---\n\n')

  return `${userContext}The user has ${allMemories.length} total memories. Here are ALL of them — search thoroughly:

${memoriesContext}

${conversationContext}
═══
The user just said: "${question}"
═══

SEARCH RULES — follow these carefully:
1. Search EVERYTHING — title, content, tags, ai_summary, all memory types including images voice notes and links
2. Do partial matching — if they say "that cafe" look for ANY memory mentioning a cafe, coffee shop, restaurant, place to eat
3. Do semantic matching — if they say "that book someone recommended" look for memories with words like book, read, reading, novel, author, recommendation, suggested
4. Check date ranges — if they say "last month" filter by date, "recently" means last 2 weeks
5. If you find something even slightly related mention it
6. Only say you found nothing after genuinely exhausting every possible match
7. If you truly find nothing say it warmly like a friend would
8. QUOTE exact titles and content from memories rather than paraphrasing
9. Include relevant memory IDs in referencedIds
10. NEVER fabricate or hallucinate memory content — only reference what's actually there
11. IMPORTANT — IMAGE MEMORIES: Some memories are images where text was extracted from a photo. When searching image memories treat the extracted text as if you are reading the actual image — every single word, number, and value in the extracted text is visible in that image. If a user asks about something that appears in extracted image text, you have found it. Never say something isn't in an image memory unless you have read every single word of its extracted text and confirmed it genuinely isn't there.

RESPOND with JSON:
{
  "answer": "Your warm natural response",
  "referencedIds": ["id1", "id2"]
}`
}

// ─────────────────────────────────────────────────────────
// MAIN ASK ROUTE
// ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { question, memories, chatHistory, userId } = (await req.json()) as {
      question: string
      memories: MemoryData[]
      chatHistory?: ChatHistoryItem[]
      userId?: string
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

    // Fetch user profile for personalization
    let userContext = ''
    let displayName = ''
    try {
      if (userId) {
        const supabase = await createServerSupabaseClient()
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('learned_facts, personality_notes, display_name')
          .eq('user_id', userId)
          .single()

        if (profile) {
          displayName = profile.display_name || ''
          const facts = profile.learned_facts as Array<{ fact: string; category: string; confidence: string }> | null
          userContext = `
WHAT YOU KNOW ABOUT THIS PERSON:
${displayName ? `Name: ${displayName}` : 'Name: Unknown'}
${profile.personality_notes || ''}

${facts && facts.length > 0 ? `Specific things you've learned:\n${facts.map((f) => `- ${f.fact}`).join('\n')}` : ''}

Use this naturally in conversation — reference their name occasionally, connect topics to their known interests, ask follow up questions about their ongoing goals. This is what makes you feel like a real friend who knows them.
Never list these facts robotically — weave them in naturally.
`
        }
      }
    } catch {
      // User profile not available — continue without personalization
    }

    // ──── DECISION: Just Chatting or Memory Search? ────
    const noMemories = !memories || !Array.isArray(memories) || memories.length === 0
    const isSearch = !noMemories && isMemorySearch(question)

    let responseText: string

    if (!isSearch) {
      // ═══════ CONVERSATION PATH: ZERO memories sent ═══════
      const userPrompt = buildConversationPrompt(question, conversationContext, userContext)
      responseText = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.7, 800)
    } else {
      // ═══════ MEMORY SEARCH PATH: Send ALL memories ═══════
      // Trim each memory's content to 400 chars but send all of them (image memories get FULL content)
      const allMemoriesTrimmed = memories.map((m) => ({
        ...m,
        content: m.type === 'image' ? (m.content || '') : (m.content || '').slice(0, 400),
        aiSummary: m.aiSummary ? m.aiSummary.slice(0, 150) : undefined,
      }))
      const userPrompt = buildMemorySearchPrompt(
        allMemoriesTrimmed,
        question,
        conversationContext,
        userContext
      )
      responseText = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.4, 1200)
    }

    // Parse the JSON response with fallback
    let result = parseAIResponse(responseText)

    if (!result || !result.answer) {
      const fallbackAnswer = responseText
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .replace(/\{[^}]*"referencedIds"[^}]*\}/g, '')
        .replace(/\{[^}]*"sourcesCount"[^}]*\}/g, '')
        .trim()

      result = {
        answer: fallbackAnswer || "Hmm something went wrong — try asking me again? 😊",
        referencedIds: [],
        detectedMode: 'conversation' as const,
        confidence: 'high' as const,
      }
    }

    // For conversation path, always reset these
    if (!isSearch) {
      result.referencedIds = []
      result.detectedMode = 'conversation'
      result.confidence = 'high'
    } else {
      // Validate referencedIds exist in the provided memories
      const memoryIds = new Set(memories.map((m) => m.id))
      if (Array.isArray(result.referencedIds)) {
        result.referencedIds = (result.referencedIds as string[]).filter((id) => memoryIds.has(id))
      } else {
        result.referencedIds = []
      }

      // Validate detectedMode
      const validModes: string[] = ['memory-search', 'conversation', 'both']
      const detectedMode = String(result.detectedMode || '')
      if (!detectedMode || !validModes.includes(detectedMode)) {
        if (result.referencedIds.length > 0) {
          result.detectedMode = 'both'
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
        detectedMode: 'conversation',
        confidence: 'low',
      })
    }

    return NextResponse.json({
      answer: "Hmm something went wrong on my end — try again? I'm here 💙",
      referencedIds: [],
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
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      if (typeof parsed.answer === 'string') {
        return {
          answer: parsed.answer,
          referencedIds: Array.isArray(parsed.referencedIds) ? parsed.referencedIds as string[] : [],
          detectedMode: (parsed.detectedMode as AskResult['detectedMode']) || 'conversation',
          confidence: (parsed.confidence as AskResult['confidence']) || 'high',
        }
      }
      return null
    } catch {
      try {
        const cleaned = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/'/g, '"')
        const parsed = JSON.parse(cleaned) as Record<string, unknown>
        if (typeof parsed.answer === 'string') {
          return {
            answer: parsed.answer,
            referencedIds: Array.isArray(parsed.referencedIds) ? parsed.referencedIds as string[] : [],
            detectedMode: (parsed.detectedMode as AskResult['detectedMode']) || 'conversation',
            confidence: (parsed.confidence as AskResult['confidence']) || 'high',
          }
        }
        return null
      } catch {
        const answerMatch = responseText.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/)
        if (answerMatch) {
          return {
            answer: answerMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
            referencedIds: [],
            detectedMode: 'conversation',
            confidence: 'high',
          }
        }
      }
    }
  }

  return null
}

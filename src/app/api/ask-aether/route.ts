import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'

// ═══════════════════════════════════════════════════════════════
// ASK AETHER — Shared AI Route
// ═══════════════════════════════════════════════════════════════
// Two modes:
//   1. QUESTION mode — user asks about their memories
//   2. DAILY RECAP mode — no question, just memories → AI summary
// ═══════════════════════════════════════════════════════════════

interface MemoryItem {
  id?: string
  content: string
  title?: string
  type?: string
  tags?: string[]
  created_at?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, memories } = body as {
      question?: string
      memories?: MemoryItem[]
    }

    // Format memories into a readable context string
    const hasMemories = memories && Array.isArray(memories) && memories.length > 0
    const memoriesContext = hasMemories
      ? memories!
          .slice(0, 20) // Cap at 20 most recent to stay within token limits
          .map((m, i) => {
            const date = m.created_at
              ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : ''
            const title = m.title ? `"${m.title}"` : ''
            const tags = m.tags && m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : ''
            return `${i + 1}. ${title}${date ? ` (${date})` : ''}${tags}: ${m.content.slice(0, 200)}`
          })
          .join('\n')
      : 'No memories saved yet.'

    let systemPrompt: string
    let userPrompt: string

    if (question && question.trim()) {
      // ═══════════════════════════════════════════════════
      // MODE 1: QUESTION — Answer based on memories
      // ═══════════════════════════════════════════════════
      systemPrompt = `You are Aether, an intelligent, witty, and supportive second brain. You help users recall and connect with their saved thoughts. You speak warmly and conversationally, like a close friend who happens to remember everything. You use contractions, occasional emojis (max 1-2), and keep responses concise (2-4 sentences max). Never sound robotic or corporate.`

      userPrompt = `The user is asking a question about their past notes. Here are their recent notes:

${memoriesContext}

The user asks: "${question}"

Answer their question concisely and conversationally based ONLY on the provided notes. If the answer isn't in the notes, say something warm like "I couldn't find anything about that in your memories" — maybe suggest they save it for next time.`
    } else {
      // ═══════════════════════════════════════════════════
      // MODE 2: DAILY RECAP — Summarize recent memories
      // ═══════════════════════════════════════════════════
      systemPrompt = `You are Aether, an intelligent, witty, and supportive second brain. You generate short, warm daily recaps that help users reconnect with their recent thoughts. You're encouraging and slightly playful — like a friend who's excited about what they've been thinking about. Keep it to exactly 2 sentences. Use contractions and 1 emoji max.`

      userPrompt = `Here are the user's recent notes:

${memoriesContext}

Generate a short, 2-sentence "Daily Recap" that highlights the most important or interesting thing they saved recently. Be encouraging and slightly playful.`
    }

    const aiResponse = await callAI(systemPrompt, userPrompt, 0.7, 200)

    // Clean up the response — remove quotes if the AI wrapped it
    const cleanResponse = aiResponse
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\n+/g, ' ')
      .trim()

    return NextResponse.json({ response: cleanResponse })
  } catch (error) {
    console.error('[Aether] Ask-Aether error:', error)

    // Handle provider exhaustion gracefully
    if (error instanceof Error && error.message === 'ALL_PROVIDERS_EXHAUSTED') {
      return NextResponse.json({
        response: "I need a little rest right now — my thinking engines are taking a short break. Try again in a bit and I'll be fully back! 💜",
      })
    }

    return NextResponse.json({
      response: "Hmm, something went wrong on my end — try again? I'm here 💙",
    })
  }
}

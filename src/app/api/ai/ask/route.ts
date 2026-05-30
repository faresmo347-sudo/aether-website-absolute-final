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

export async function POST(req: NextRequest) {
  try {
    const { question, memories } = (await req.json()) as {
      question: string
      memories: MemoryData[]
    }

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Handle the case where there are no memories — the AI can still have a conversation
    if (!memories || !Array.isArray(memories) || memories.length === 0) {
      const groq = getGroqClient()

      const noMemoryPrompt = `The user has no saved memories yet. They just said: "${question}"

Since they have no memories, this is a GENERAL CONVERSATION. Talk to them warmly as Aether — their memory companion. You can:
- Answer their question conversationally
- Suggest they start saving memories so you can help them find things later
- Just be a good companion and chat with them

Respond with JSON:
{
  "answer": "Your warm response",
  "referencedIds": [],
  "sourcesCount": 0,
  "detectedMode": "conversation"
}`

      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: AETHER_MASTER_PROMPT },
          { role: 'user', content: noMemoryPrompt },
        ],
        temperature: 0.6,
        max_tokens: 1024,
      })

      const responseText = completion.choices[0]?.message?.content || ''
      let result
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        }
      } catch {
        // Fallback
      }

      if (!result || !result.answer) {
        result = {
          answer: "Hey! I'd love to chat with you. Once you start saving some memories, I'll be able to help you find them too!",
          referencedIds: [],
          sourcesCount: 0,
          detectedMode: 'conversation' as const,
        }
      }

      result.referencedIds = []
      result.sourcesCount = 0
      result.detectedMode = result.detectedMode || 'conversation'

      return NextResponse.json(result)
    }

    const groq = getGroqClient()

    // Format memories for the LLM context — image memories get special prefix for searchability
    const memoriesContext = memories
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

    const systemPrompt = AETHER_MASTER_PROMPT

    const userPrompt = `The user has ${memories.length} saved memories. Here they all are:

${memoriesContext}

═══
The user just said: "${question}"
═══

STEP 1 — DETECT THE MODE:
Read the user's message carefully and decide:
- Is this a MEMORY SEARCH? (they want to find/recall something they saved)
- Is this a GENERAL CONVERSATION? (they want to talk, vent, think out loud, or ask a general question)
- Is it BOTH? (they're chatting AND want to find something)

STEP 2 — RESPOND AS AETHER:
- If MEMORY SEARCH: Search through their memories carefully. Reference specific dates, titles, and content. Put relevant IDs in referencedIds.
- If CONVERSATION: Talk to them like a warm friend. Listen, support, advise. Only reference a memory if it naturally fits. referencedIds should be [].
- If BOTH: Start conversationally, then naturally bring in relevant memories. Put referenced IDs in referencedIds.

STEP 3 — SET THE MODE:
Include "detectedMode" in your JSON response: "memory-search", "conversation", or "both"

ALWAYS respond with the JSON format specified in your system instructions.`

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 1024,
    })

    const responseText = completion.choices[0]?.message?.content || ''

    // Parse the JSON response
    let result
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      }
    } catch {
      // Fallback
    }

    if (!result || !result.answer) {
      result = {
        answer: responseText || "I couldn't find any relevant memories for your question.",
        referencedIds: [],
        sourcesCount: 0,
        detectedMode: 'conversation' as const,
      }
    }

    // Validate referencedIds exist in the provided memories
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

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI ask error:', error)
    return NextResponse.json({
      answer: 'Sorry, I had trouble searching your memories. Please try again.',
      referencedIds: [],
      sourcesCount: 0,
      detectedMode: 'conversation',
    })
  }
}

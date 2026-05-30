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
  "detectedMode": "conversation"
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

    const userPrompt = `The user has ${memories.length} saved memories. Here they all are:

${memoriesContext}
${conversationContext}
═══
The user just said: "${question}"
═══

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
- If MEMORY SEARCH: Search through their memories carefully. Reference specific dates, titles, and content. Put relevant IDs in referencedIds.
- If CONVERSATION: Talk to them like a warm friend. Listen, support, advise. Only reference a memory if it naturally fits. referencedIds should be [].
- If BOTH: Start conversationally, then naturally bring in relevant memories. Put referenced IDs in referencedIds.

STEP 3 — SET THE MODE:
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

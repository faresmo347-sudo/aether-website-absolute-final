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

    if (!memories || !Array.isArray(memories) || memories.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find any memories to search through. Try saving some memories first!",
        referencedIds: [],
        sourcesCount: 0,
      })
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

The user just said: "${question}"

Decide first: is this a memory search, a general conversation, or both?
Then respond as Aether — warm, caring, and human.
If you find relevant memories, reference them specifically with dates and details.
If it is just a conversation, be a good companion.
Always respond with the JSON format.`

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

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI ask error:', error)
    return NextResponse.json({
      answer: 'Sorry, I had trouble searching your memories. Please try again.',
      referencedIds: [],
      sourcesCount: 0,
    })
  }
}

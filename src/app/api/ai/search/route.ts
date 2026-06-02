import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'
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
      })
    }

    // Format memories for the LLM context — image memories get FULL content
    const memoriesContext = memories
      .map((m) => {
        const date = new Date(m.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        if (m.type === 'image') {
          return `[MEMORY ID: ${m.id}] [IMAGE - Text Extracted from Photo] [${date}] "${m.title}"
EXTRACTED TEXT FROM IMAGE:
${m.content || 'No text extracted'}
${m.aiSummary ? `AI Summary: ${m.aiSummary.slice(0, 150)}` : ''} Tags: ${m.tags.join(', ')}`
        }
        return `[ID: ${m.id}] [${m.type}] [${date}] "${m.title}" — ${m.content.slice(0, 400)}${m.aiSummary ? ` (AI Summary: ${m.aiSummary.slice(0, 100)})` : ''} Tags: ${m.tags.join(', ')}`
      })
      .join('\n')

    const userPrompt = `The user has ${memories.length} saved memories. Here they all are:

${memoriesContext}

The user just said: "${question}"

Decide first: is this a memory search, a general conversation, or both?
Then respond as Aether — warm, caring, and human.
If you find relevant memories, reference them specifically with dates and details.
If it is just a conversation, be a good companion.
IMAGE MEMORIES: Some memories are images where text was extracted from a photo. Treat the extracted text as if you are reading the actual image — every word, number, and value in the extracted text is visible in that image.
Always respond with the JSON format specified in your system instructions.`

    const responseText = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.6, 1024)

    // Parse the JSON response
    let result: Record<string, unknown>
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        result = { answer: responseText }
      }
    } catch {
      result = { answer: responseText }
    }

    if (!result.answer) {
      result = {
        answer: "I couldn't find any relevant memories for your question.",
        referencedIds: [],
      }
    }

    // Validate referencedIds exist in the provided memories
    const memoryIds = new Set(memories.map((m) => m.id))
    if (Array.isArray(result.referencedIds)) {
      result.referencedIds = (result.referencedIds as string[]).filter((id) => memoryIds.has(id))
    } else {
      result.referencedIds = []
    }

    // Remove sourcesCount if the AI included it
    delete result.sourcesCount

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI search error:', error)

    if (error instanceof Error && error.message === 'ALL_PROVIDERS_EXHAUSTED') {
      return NextResponse.json({
        answer: "I need a little rest right now — both my thinking engines are taking a short break. Try again in about an hour and I'll be fully back for you! 💜",
        referencedIds: [],
      })
    }

    return NextResponse.json({
      answer: 'Sorry, I had trouble searching your memories. Please try again.',
      referencedIds: [],
    })
  }
}

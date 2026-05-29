import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'

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

    const systemPrompt = `You are Aether, an AI assistant that helps users find information from their saved memories. Your job is to search through the user's memories and answer their question based ONLY on what you find.

CRITICAL RULES:
1. You must ONLY reference memories that are actually relevant to the question asked
2. You must NEVER return a memory that has no relation to what was asked
3. If the user asks about something recent (e.g., "today", "this week"), prioritize the most recently saved relevant memories
4. If no relevant memory exists, honestly say "I could not find any memory about that" — do NOT make up or hallucinate information
5. Your response must always reference the actual content of the memories you found
6. Rank results by relevance to the exact question asked
7. When you reference a memory, include its ID in your referencedIds list
8. IMPORTANT: Image memories contain full structured text extracted from images (marked with "[IMAGE - Full Text Extracted]:"). When searching for specific information that might be in an image (like a price, a name, a list item, a category, a menu item, a document section), you MUST check the content of ALL image-type memories, not just text/voice memories. Image memories contain full structured text extracted from photos — including menus with every item and price, documents with every section, screenshots with every UI element. Treat image memory content as searchable text just like any other memory type.

You must respond with a JSON object with these fields:
- "answer": A natural language response answering the user's question based on their memories. Be specific and reference the actual content.
- "referencedIds": An array of memory IDs that are relevant to the question (only include IDs from the provided memories)
- "sourcesCount": The number of memories you referenced

If no memories are relevant, set referencedIds to [] and sourcesCount to 0, and say you couldn't find anything relevant.`

    const userPrompt = `Here are all my saved memories (note: memories marked [IMAGE - Full Text Extracted] contain the full structured text content extracted from photos and screenshots — search through them just like any other text memory):

${memoriesContext}

My question: ${question}

Search through ALL my memories, INCLUDING image-type memories (which contain full structured text extracted from photos), and answer based on what you find. Remember: only reference memories that are actually relevant. If nothing matches, say so honestly.`

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
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

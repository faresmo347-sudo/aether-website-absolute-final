import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'


export async function POST(req: NextRequest) {
  try {
    const { content, type, tags, title } = await req.json() as {
      content: string
      type: string
      tags: string[]
      title: string
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const groq = getGroqClient()

    const systemPrompt = AETHER_MASTER_PROMPT

    // Build a rich user prompt with all available context
    const contextParts: string[] = []

    if (title) {
      contextParts.push(`Title: "${title}"`)
    }

    contextParts.push(`Type: ${type || 'text'}`)
    contextParts.push(`Content: "${content.slice(0, 1500)}"`)

    if (tags && Array.isArray(tags) && tags.length > 0) {
      contextParts.push(`Existing tags: ${tags.join(', ')}`)
    }

    const contextBlock = contextParts.join('\n')

    const userPrompt = `Generate a warm, insightful summary for this memory. Remember: 3-5 sentences, personal tone ("You visited/captured/noted..."), reference specific details, suggest connections or actions, and NEVER start with "This is a memory about..."

${contextBlock}`

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 512,
    })

    const insight = completion.choices[0]?.message?.content?.trim() || ''

    if (!insight) {
      return NextResponse.json({
        insight: 'You captured something worth remembering. Consider reviewing the details and adding it to a relevant collection for easy access later.',
      })
    }

    return NextResponse.json({ insight })
  } catch (error) {
    console.error('AI insights error:', error)
    return NextResponse.json({
      insight: 'You captured something worth remembering. Consider reviewing the details and adding it to a relevant collection for easy access later.',
    })
  }
}

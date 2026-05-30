import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'

const DEFAULT_INSIGHT = 'You captured something worth remembering. Consider reviewing the details and adding it to a relevant collection for easy access later.'

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

    const insight = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.6, 512)

    if (!insight || !insight.trim()) {
      return NextResponse.json({ insight: DEFAULT_INSIGHT })
    }

    return NextResponse.json({ insight: insight.trim() })
  } catch (error) {
    console.error('AI insights error:', error)

    // If all providers exhausted, fail silently — memory still saves without AI insight
    if (error instanceof Error && error.message === 'ALL_PROVIDERS_EXHAUSTED') {
      return NextResponse.json({ insight: DEFAULT_INSIGHT })
    }

    return NextResponse.json({ insight: DEFAULT_INSIGHT })
  }
}

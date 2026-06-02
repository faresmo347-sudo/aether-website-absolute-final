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

    // Add memory type context for type-specific insights
    const typeContext = type ? `This is a ${type.toUpperCase()} memory. Process it accordingly.\n` : ''
    const typeInstructions: Record<string, string> = {
      image: 'Reference what was actually IN the image — not just "you saved an image". Describe the content, text, or scene visible.\n',
      voice: 'Reference specific things said in the voice note — not just "you recorded a voice note". Quote or paraphrase the transcript.\n',
      link: 'Reference the actual content from the linked page — not just "you saved a link". Mention the topic or key information.\n',
    }
    const typeInstruction = typeInstructions[type || ''] || ''

    const userPrompt = `Generate a warm, insightful summary for this memory. Remember: 3-5 sentences, personal tone ("You visited/captured/noted..."), reference specific details, suggest connections or actions, and NEVER start with "This is a memory about..."

${typeContext}${typeInstruction}${contextBlock}`

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

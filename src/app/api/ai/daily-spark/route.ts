import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'

/**
 * Daily Spark — resurfaces an old memory with an AI-generated warm reflection.
 * This addresses ADHD "object permanence" — users forget what they saved.
 * The spark provides a gentle, emotionally resonant re-encounter.
 */
export async function POST(req: NextRequest) {
  try {
    const { content, type, title, tags, createdAt } = await req.json() as {
      content: string
      type: string
      title?: string
      tags?: string[]
      createdAt?: string
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Format how long ago this memory was saved
    let timeAgo = 'a while back'
    if (createdAt) {
      const now = new Date()
      const then = new Date(createdAt)
      const diffDays = Math.floor((now.getTime() - then.getTime()) / 86400000)
      if (diffDays === 1) timeAgo = 'yesterday'
      else if (diffDays < 7) timeAgo = `${diffDays} days ago`
      else if (diffDays < 30) timeAgo = `${Math.floor(diffDays / 7)} weeks ago`
      else if (diffDays < 365) timeAgo = `${Math.floor(diffDays / 30)} months ago`
      else timeAgo = 'over a year ago'
    }

    const tagsContext = tags && tags.length > 0
      ? `\nTags: ${tags.join(', ')}`
      : ''

    const titleContext = title
      ? `\nOriginal title: "${title}"`
      : ''

    const userPrompt = `You just resurfaced an old memory from the user's past — saved ${timeAgo}. Write a SHORT, warm, 1-2 sentence reflection that helps them reconnect with this thought. Think of it like a friend gently reminding them: "Hey, remember this?"

Rules:
- 1-2 sentences MAX
- Warm and personal tone — like a friend, not an AI
- Reference something specific from the content
- If it's an idea, express curiosity about what happened with it
- If it's a link, mention what interested them about it
- If it's a task, gently ask if they got to it
- No emojis in the reflection (the ✨ icon handles that)
- No quotes around the text
- Never start with "This memory" or "You saved"

Content: "${content.slice(0, 500)}"${titleContext}${tagsContext}

Return ONLY the reflection text, nothing else.`

    const reflection = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.7, 100)

    const cleanReflection = reflection
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\n/g, ' ')
      .trim()

    return NextResponse.json({
      reflection: cleanReflection || 'Something worth remembering from your past.',
      timeAgo,
    })
  } catch (error) {
    console.error('Daily Spark error:', error)

    if (error instanceof Error && error.message === 'ALL_PROVIDERS_EXHAUSTED') {
      return NextResponse.json({
        reflection: 'A thought from your past, worth revisiting.',
        timeAgo: 'a while back',
      })
    }

    return NextResponse.json({
      reflection: 'A thought from your past, worth revisiting.',
      timeAgo: 'a while back',
    })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'

function buildSystemPrompt(): string {
  return `You are Aether, an AI insight companion for a personal memory app. Your job is to generate warm, conversational insights about a user's saved memory.

CRITICAL RULES:
1. Write exactly 3-5 sentences — no more, no less.
2. Be warm and personal, as if speaking directly to the user ("You visited...", "You captured...", "You noted...").
3. NEVER start with "This is a memory about..." or "This memory contains..." — always use direct, personal language.
4. Analyze the full content and explain what the memory contains and why it might be important to the user.
5. Identify key topics and any action items or follow-ups the user might want to take.
6. Suggest meaningful connections — for example, if it's about a cafe visit, suggest "Consider adding it to your Travel or Food collection."
7. Be intelligent and specific — reference actual details from the content. NEVER give generic or boilerplate responses.
8. Do NOT use phrases like "This memory" or "This note" — speak as if you understand the user's experience directly.
9. End with a helpful suggestion when appropriate (collections to add, people to follow up with, actions to take).

EXAMPLE OUTPUTS:
- Cafe visit: "You visited this charming cafe and found it worth remembering — possibly a spot you'd love to return to or recommend to friends. The details suggest this was a genuinely positive experience with great ambiance. Consider adding it to your Travel or Food collection so you can easily find it next time you're craving a similar outing."
- Meeting notes: "You captured key decisions from this meeting, including action items that may need follow-up. The discussion touched on project timelines and resource allocation, both of which could impact your upcoming deliverables. Consider setting reminders for the action items and tagging the relevant team members to keep everyone aligned."
- Book recommendation: "You saved a book recommendation that clearly resonated with you — perhaps it aligns with a topic you've been exploring lately. The themes suggest it could offer fresh perspectives on your current interests. Consider adding it to a Reading collection so you can track it alongside other books you've been meaning to dive into."

Return ONLY a plain text insight string — no JSON, no markdown, no extra formatting.`
}

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

    const systemPrompt = buildSystemPrompt()

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
      temperature: 0.5,
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

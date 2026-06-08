import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'

/**
 * Generate a human-friendly title from raw memory content.
 * This is the "UPGRADE 2: Gravity Capture Bar" feature —
 * instead of showing raw text, cards show a friendly title like
 * "That cool PC build link" or "Meeting notes about Q3 launch".
 */
export async function POST(req: NextRequest) {
  try {
    const { content, type, tags } = await req.json() as {
      content: string
      type: string
      tags?: string[]
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // For very short content, the content itself is the title
    if (content.trim().length <= 40) {
      return NextResponse.json({ title: content.trim() })
    }

    // For links, extract a useful title from the URL or enriched content
    let contextBlock = ''
    if (type === 'link') {
      // Try to extract any site name or description from enriched content
      const siteMatch = content.match(/\[From\s+(.+?)\]/)
      const descMatch = content.replace(/\[From\s+.+?\]\s*\n*/, '').trim()
      if (siteMatch) {
        contextBlock = `Link from ${siteMatch[1]}: "${descMatch.slice(0, 300)}"`
      } else {
        contextBlock = `Saved link: "${content.slice(0, 300)}"`
      }
    } else {
      contextBlock = `"${content.slice(0, 500)}"`
    }

    const tagsContext = tags && tags.length > 0
      ? `\nContext tags: ${tags.join(', ')}`
      : ''

    const userPrompt = `Generate a SHORT, HUMAN-FRIENDLY title for this memory. Think of how a person would describe it to a friend in a few words — not a formal title, not a summary, but a natural casual label.

Examples:
- Raw: "I need to check out that PC build with the RTX 4090 and custom water cooling loop on pcpartpicker" → Title: "That cool PC build link"
- Raw: "Meeting with Sarah about the Q3 product launch timeline, she wants the beta ready by March 15th" → Title: "Q3 launch meeting with Sarah"
- Raw: "Remember to buy milk, eggs, bread, and that special cheese from the farmer's market" → Title: "Grocery list + farmer's market cheese"
- Raw: "[From YouTube] Building a Smart Home with Home Assistant..." → Title: "Smart home setup video"

Rules:
- 3-6 words ideally, max 8 words
- Casual and natural — like how you'd label a note for yourself
- Capture the ESSENCE, not the details
- No punctuation at the end
- No quotes around the title
- Never start with "A", "An", or "The"

${contextBlock}${tagsContext}

Return ONLY the title text, nothing else.`

    const title = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.5, 60)

    // Clean up the response — remove quotes, trim whitespace
    const cleanTitle = title
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\n/g, ' ')
      .trim()

    if (!cleanTitle) {
      // Fallback: use first ~40 chars
      return NextResponse.json({ title: content.slice(0, 40).trim() + (content.length > 40 ? '...' : '') })
    }

    return NextResponse.json({ title: cleanTitle })
  } catch (error) {
    console.error('Title generation error:', error)

    if (error instanceof Error && error.message === 'ALL_PROVIDERS_EXHAUSTED') {
      return NextResponse.json({ title: '' })
    }

    // Return empty — caller will use fallback
    return NextResponse.json({ title: '' })
  }
}

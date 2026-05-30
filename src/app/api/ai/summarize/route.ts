import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json() as {
      text: string
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Transcription text is required' }, { status: 400 })
    }

    const userPrompt = `Summarize this voice note as Aether — warm, personal, capturing the feeling AND the facts. Extract key points. Respond with JSON: { "summary": "1-2 sentence warm summary", "keyPoints": ["point1", "point2"] }

Voice transcription: "${text}"`

    const responseText = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.6, 512)

    let result: { summary: string; keyPoints: string[] }
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        result = { summary: responseText, keyPoints: [] }
      }
    } catch {
      result = { summary: responseText, keyPoints: [] }
    }

    // Ensure required fields
    if (!result.summary) {
      result.summary = text.slice(0, 100)
    }
    if (!Array.isArray(result.keyPoints)) {
      result.keyPoints = []
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Summarize error:', error)

    // If all providers exhausted, fail silently with a basic summary
    if (error instanceof Error && error.message === 'ALL_PROVIDERS_EXHAUSTED') {
      const { text } = (await req.json().catch(() => ({ text: '' }))) as { text: string }
      return NextResponse.json({
        summary: text ? text.slice(0, 100) : 'Voice note saved.',
        keyPoints: [],
      })
    }

    return NextResponse.json(
      { error: 'Summarization failed', summary: '', keyPoints: [] },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json() as {
      text: string
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Transcription text is required' }, { status: 400 })
    }

    const groq = getGroqClient()

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: AETHER_MASTER_PROMPT,
        },
        {
          role: 'user',
          content: `Summarize this voice note as Aether — warm, personal, capturing the feeling AND the facts. Extract key points. Respond with JSON: { "summary": "1-2 sentence warm summary", "keyPoints": ["point1", "point2"] }\n\nVoice transcription: "${text}"`,
        },
      ],
      temperature: 0.6,
      max_tokens: 512,
    })

    const responseText = completion.choices[0]?.message?.content || ''

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
    return NextResponse.json(
      { error: 'Summarization failed', summary: '', keyPoints: [] },
      { status: 500 }
    )
  }
}

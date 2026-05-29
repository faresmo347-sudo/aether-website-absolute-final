import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'

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
          content: `You are a helpful assistant that summarizes voice notes. Given a transcription of a voice memo, provide:
1. A concise 1-2 sentence summary of what was said
2. A list of any action items or key points extracted from the content

Respond with a JSON object with these fields:
- "summary": A 1-2 sentence summary of the voice note
- "keyPoints": An array of key points or action items (strings). If none are found, return an empty array.

Return ONLY the JSON object, no other text.`,
        },
        {
          role: 'user',
          content: `Summarize this voice note and extract any action items or key points:\n\n${text}`,
        },
      ],
      temperature: 0.3,
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

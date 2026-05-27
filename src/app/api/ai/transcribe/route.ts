import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: InstanceType<typeof ZAI> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json()

    if (!audio || typeof audio !== 'string') {
      return NextResponse.json({ error: 'Audio base64 is required' }, { status: 400 })
    }

    const zai = await getZAI()

    // Transcribe the audio using ASR
    const response = await zai.audio.asr.create({
      file_base64: audio,
    })

    const transcription = response.text || ''

    if (!transcription.trim()) {
      return NextResponse.json({ transcription: '', summary: '' })
    }

    // Generate a summary of the transcription
    const summaryCompletion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            'You are a helpful assistant that summarizes voice notes. Given a transcription of a voice memo, provide a concise 1-2 sentence summary. Return ONLY the summary text, nothing else.',
        },
        {
          role: 'user',
          content: `Summarize this voice note in 1-2 sentences:\n\n${transcription}`,
        },
      ],
      thinking: { type: 'disabled' },
    })

    const summary = summaryCompletion.choices[0]?.message?.content || ''

    return NextResponse.json({ transcription, summary })
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Transcription failed', transcription: '', summary: '' },
      { status: 500 }
    )
  }
}

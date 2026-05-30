import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient } from '@/lib/groq'
import { callAI } from '@/lib/ai-provider'

export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json()

    if (!audio || typeof audio !== 'string') {
      return NextResponse.json({ error: 'Audio base64 is required' }, { status: 400 })
    }

    // Step 1: Transcribe the audio using Groq Whisper API (Groq-specific — can't switch to Gemini)
    const groq = getGroqClient()
    const audioBuffer = Buffer.from(audio, 'base64')
    const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' })

    const transcription = await groq.audio.transcriptions.create({
      model: 'whisper-large-v3-turbo',
      file: file,
      response_format: 'json',
    })

    const transcribedText = transcription.text || ''

    if (!transcribedText.trim()) {
      return NextResponse.json({ transcription: '', summary: '' })
    }

    // Step 2: Generate a summary using callAI (Gemini primary, Groq fallback)
    let summary = ''
    try {
      summary = await callAI(
        'You are a helpful assistant that summarizes voice notes. Given a transcription of a voice memo, provide a concise 1-2 sentence summary. Return ONLY the summary text, nothing else.',
        `Summarize this voice note in 1-2 sentences:\n\n${transcribedText}`,
        0.3,
        128
      )
    } catch {
      // If AI providers fail, use a basic truncation as fallback
      summary = transcribedText.slice(0, 100)
    }

    return NextResponse.json({ transcription: transcribedText, summary })
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Transcription failed', transcription: '', summary: '' },
      { status: 500 }
    )
  }
}

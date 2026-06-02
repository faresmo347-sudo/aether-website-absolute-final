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
      return NextResponse.json({ transcription: '', summary: '', title: '', error: 'Transcription failed — please try again' })
    }

    // Step 2: Generate a title and summary using callAI (Gemini primary, Groq fallback)
    let title = ''
    let summary = ''
    try {
      const aiResponse = await callAI(
        'You are a helpful assistant that processes voice notes. This is a VOICE memory. Process it accordingly. Given a transcription of a voice memo, return a JSON object with a title and summary. The title should be a 5-7 word summary of the TOPIC discussed (not "Voice Note" or a timestamp). The summary should be a concise 1-2 sentence warm summary. Return ONLY the JSON object: { "title": "...", "summary": "..." }',
        `Generate a title and summary for this voice note:\n\n${transcribedText}`,
        0.3,
        256
      )

      try {
        const firstBrace = aiResponse.indexOf('{')
        const lastBrace = aiResponse.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = aiResponse.slice(firstBrace, lastBrace + 1)
          const parsed = JSON.parse(jsonStr)
          if (parsed.title) title = parsed.title
          if (parsed.summary) summary = parsed.summary
        }
      } catch {
        // JSON parse failed — try to use the response as summary directly
        summary = aiResponse.trim()
      }
    } catch {
      // If AI providers fail, use a basic truncation as fallback
      summary = transcribedText.slice(0, 100)
    }

    return NextResponse.json({ transcription: transcribedText, summary, title })
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Transcription failed', transcription: '', summary: '', title: '' },
      { status: 500 }
    )
  }
}

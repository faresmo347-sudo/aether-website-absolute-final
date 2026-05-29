import Groq from 'groq-sdk'

// Singleton Groq client — server-side only
// The GROQ_API_KEY is read from process.env and never exposed to the browser.

let groqInstance: Groq | null = null

export function getGroqClient(): Groq {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error(
        '[Aether] GROQ_API_KEY environment variable is not set. ' +
        'Please add it to your .env file or Vercel environment variables.'
      )
    }
    groqInstance = new Groq({ apiKey })
  }
  return groqInstance
}

// Default model for all text AI features
export const GROQ_MODEL = 'llama-3.3-70b-versatile'

import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const VISION_PROMPT = `You are an AI assistant for a personal memory app called Aether. Analyze this image carefully and return a JSON object with:
- "description": A detailed description that includes ALL text and information visible in the image. If the image contains text (lists, menus, documents, screenshots, signs, notes, etc.), extract and list EVERY piece of text verbatim. If it contains a document, transcribe it fully. If it contains a list, list every item. If it contains a menu, list every item with prices. Never just say "this is a screenshot" — always extract the actual content. Be thorough and detailed.
- "tags": array of 3-5 specific hashtags (with # symbol) based on ALL the content and text you found in the image

CRITICAL RULES:
1. EXTRACT ALL TEXT — do not summarize or skip any visible text in the image
2. If the image has a document, transcription, or list — include every word, number, and detail
3. NEVER use generic tags like #image, #photo, #capture, #picture. Be specific to the actual content
4. The description must be useful for searching — someone should be able to find this image by searching for any text that appears in it

Return ONLY the JSON object.`

const TAG_SYSTEM_PROMPT = `You are an intelligent tagging assistant for a personal memory app. Generate 2-4 highly specific, relevant hashtags based on the ACTUAL CONTENT described.

CRITICAL RULES:
1. Tags MUST reflect the SPECIFIC TOPICS and SUBJECT MATTER
2. NEVER use generic tags like #image, #photo, #capture, #picture, #notes, #memory
3. Be specific: food photo → #food #restaurant; code screenshot → #code #programming; place → #travel #outdoors
4. Always include the # symbol
5. Return ONLY a JSON array of tag strings, nothing else`

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json()

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ description: 'Image captured', tags: ['#image'] })
    }

    // Normalize to data URL format
    const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`

    const groq = getGroqClient()

    // Combined vision call: description + tags in one shot
    let description = 'Image captured'
    let tags: string[] = []

    try {
      const visionCompletion = await groq.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      })

      const visionText = visionCompletion.choices[0]?.message?.content?.trim() || ''

      // Try to parse JSON from the vision response
      try {
        const jsonMatch = visionText.match(/\{[\s\S]*?\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.description) description = parsed.description
          if (Array.isArray(parsed.tags)) tags = parsed.tags
        }
      } catch {
        // If JSON parse fails, use the raw text as description
        if (visionText) description = visionText
      }
    } catch (visionError) {
      console.error('Vision model error:', visionError)
    }

    // Fallback: if the combined call didn't produce tags, use a separate Groq LLM call
    if (tags.length === 0 && description !== 'Image captured') {
      try {
        const tagCompletion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: TAG_SYSTEM_PROMPT },
            { role: 'user', content: `Generate 2-4 specific tags for this image description: "${description}"` },
          ],
          temperature: 0.3,
          max_tokens: 128,
        })

        const tagResponseText = tagCompletion.choices[0]?.message?.content || ''
        try {
          const jsonMatch = tagResponseText.match(/\[[\s\S]*?\]/)
          if (jsonMatch) {
            tags = JSON.parse(jsonMatch[0])
          }
        } catch {
          const hashTags = tagResponseText.match(/#\w+/g)
          if (hashTags) {
            tags = hashTags.slice(0, 4)
          }
        }
      } catch (tagError) {
        console.error('Tag generation error:', tagError)
      }
    }

    // Filter out generic tags
    const GENERIC_TAGS = new Set([
      '#notes', '#note', '#memory', '#memories', '#image', '#photo',
      '#capture', '#picture', '#misc', '#general', '#content',
    ])
    tags = tags.filter((t) => !GENERIC_TAGS.has(t.toLowerCase()))

    if (tags.length === 0) {
      tags = ['#image']
    }

    tags = tags.slice(0, 4)

    return NextResponse.json({ description, tags })
  } catch (error) {
    console.error('Image analysis error:', error)
    return NextResponse.json({ description: 'Image captured', tags: ['#image'] })
  }
}

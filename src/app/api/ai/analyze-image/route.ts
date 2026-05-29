import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const VISION_PROMPT = `You are an AI assistant for a personal memory app called Aether. Analyze this image carefully and return a JSON object with:
- "description": A structured, exhaustive extraction of ALL content visible in the image. You MUST treat every distinct section, panel, category, or group of information as a SEPARATE item.
- "tags": array of 3-5 specific hashtags (with # symbol) based on ALL the content and text you found in the image

CRITICAL RULES:
1. MULTI-SECTION EXTRACTION: If the image contains multiple sections, panels, categories, columns, tabs, or areas — identify EACH one separately with its heading/title. Do NOT merge different sections together.
2. EXHAUSTIVE ITEM ENUMERATION: If any section contains a list, menu, table, or group of items — list EVERY SINGLE item individually with ALL its details (name, price, description, quantity, etc.).
   - For menus: "Category: Appetizers — 1. Spring Rolls $6.99, 2. Calamari $8.99; Category: Mains — 1. Burger $12.99, 2. Pasta $14.99"
   - For documents: Transcribe each section with its heading and full text
   - For screenshots with multiple UI elements: Describe each element (button, card, dialog, panel) separately with its text content
   - For tables: Reproduce every row and column value
3. PRESERVE VISUAL HIERARCHY: Organize output as Headings → Subheadings → Individual items. This makes every piece of text searchable.
4. EXTRACT ALL TEXT — do not summarize, abbreviate, or skip any visible text. Every word, number, and detail must be included.
5. NEVER use generic tags like #image, #photo, #capture, #picture. Be specific to the actual content.
6. SEARCHABILITY: The description must be so detailed and structured that someone could find ANY single piece of text in this image by searching for it. Treat the description as a searchable document, not a vague summary.

OUTPUT FORMAT for the description field:
- Start with a brief overall identification (1 sentence)
- Then use structured sections like:
  [Section/Category Name]:
  - Item 1: details
  - Item 2: details
  [Another Section]:
  - Item 1: details
  ...
- For simple images (single photo, single document), transcribe fully without unnecessary structuring

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
        max_tokens: 4096,
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

import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient, GROQ_MODEL } from '@/lib/groq'

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const VISION_PROMPT = `You are an AI assistant for a personal memory app called Aether. Analyze this image and return a JSON object with:
- "description": A structured, exhaustive extraction of ALL content visible in the image
- "tags": array of 3-5 specific hashtags (with # symbol) based on ALL the content and text you found in the image

SEARCHABILITY IS THE #1 PRIORITY:
When a user later asks "find X in this image", the AI must be able to locate X from your description alone.
Every number, name, price, date, and detail must be preserved EXACTLY as written — no paraphrasing, no rounding, no abbreviating.
The description must read like a searchable database entry, NOT a paragraph summary.

CRITICAL RULES:
1. EVERY PIECE OF TEXT IS A SEARCHABLE ENTRY: Each distinct label, value, name, or phrase must appear verbatim in the description so that a keyword search will find it.
2. MULTI-SECTION EXTRACTION: If the image contains multiple sections, panels, categories, columns, tabs, or areas — identify EACH one separately with its heading/title. Do NOT merge different sections together.
3. EXHAUSTIVE ITEM ENUMERATION: List EVERY SINGLE item individually with ALL its details.
   - For MENUS: Each item name, description, and price must be a SEPARATE entry. Example: "Appetizers: Spring Rolls — crispy vegetable rolls, served with sweet chili sauce — $6.99; Calamari — lightly breaded squid with marinara — $8.99"
   - For TABLES: Each cell value must be preserved. Reproduce every row and column exactly. Example: "Row 1: Name=Spring Rolls, Price=$6.99, Calories=350; Row 2: Name=Calamari, Price=$8.99, Calories=420"
   - For SCREENSHOTS: Every button label, heading, text block, menu item, tooltip, badge, and status indicator must be captured separately. Example: "Header: 'Dashboard'; Button: 'Save Changes'; Status: '3 items pending'; Nav item: 'Settings'"
   - For DOCUMENTS: Transcribe each section with its heading and full text verbatim
   - For RECEIPTS/INVOICES: Every line item, subtotal, tax, total, date, and reference number must appear exactly
4. PRESERVE VISUAL HIERARCHY: Organize output as Headings → Subheadings → Individual items.
5. EXTRACT ALL TEXT — do not summarize, abbreviate, round, or skip any visible text. Every word, number, and detail must be included exactly as written.
6. NEVER use generic tags like #image, #photo, #capture, #picture. Be specific to the actual content.

OUTPUT FORMAT for the description field:
- Start with a brief overall identification (1 sentence)
- Then use structured sections like:
  [Section/Category Name]:
  - Item 1: full details with exact text
  - Item 2: full details with exact text
  [Another Section]:
  - Item 1: full details with exact text
  ...
- For simple images (single photo, single document), transcribe fully without unnecessary structuring

7. DIFFERENTIATION BETWEEN ITEMS: When the image contains multiple distinct pieces of information (e.g., a menu with multiple sections and items, a table with multiple rows, a document with multiple sections), you MUST:
   a) Give each distinct item its own clearly labeled entry
   b) Preserve the relationship between items (e.g., which section an item belongs to, which row a value is in)
   c) Use unique identifiers or clear section headers so that a later search for a SPECIFIC item can find it among many
   d) NEVER merge or combine different items into a single description — each must be individually retrievable

8. USER QUERY PREPARATION: Structure the description so that if a user later asks "what is the price of X?" or "what does the Y section say?", the specific answer can be found by searching for X or Y within the description. Each data point must be individually addressable.

Example of GOOD output for a restaurant menu:
"Restaurant Menu — La Trattoria

[Appetizers]:
- Bruschetta: Toasted bread with tomatoes, basil, olive oil — $8.50
- Calamari: Lightly fried with marinara sauce — $11.00
- Soup of the Day: Chef's daily selection — $7.00

[Pasta]:
- Spaghetti Carbonara: Guanciale, pecorino, egg, black pepper — $16.00
- Penne Arrabiata: Spicy tomato sauce, chili flakes — $14.00

[Beverages]:
- House Wine (glass): Red or white — $9.00
- Espresso — $3.50"

Example of BAD output (too merged):
"A menu with appetizers like bruschetta and calamari, pasta dishes, and drinks." ← This loses all the individual data points!

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
        max_tokens: 8192,
      })

      const visionText = visionCompletion.choices[0]?.message?.content?.trim() || ''

      // Try to parse JSON from the vision response
      try {
        // Try to find the JSON object — use first { and last } for robustness
        const firstBrace = visionText.indexOf('{')
        const lastBrace = visionText.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = visionText.slice(firstBrace, lastBrace + 1)
          const parsed = JSON.parse(jsonStr)
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

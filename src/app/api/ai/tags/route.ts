import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: InstanceType<typeof ZAI> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

// Forbidden generic tags that should almost never appear
const GENERIC_TAGS = new Set([
  '#notes', '#note', '#memory', '#memories', '#thoughts', '#thought',
  '#capture', '#image', '#photo', '#picture', '#voice', '#audio',
  '#memo', '#recording', '#link', '#bookmark', '#saved', '#misc',
  '#general', '#untagged', '#unspecified', '#content', '#text',
  '#stuff', '#thing', '#item', '#entry',
])

function isGenericTag(tag: string): boolean {
  return GENERIC_TAGS.has(tag.toLowerCase())
}

function buildSystemPrompt(type: string): string {
  const baseRules = `You are an intelligent tagging assistant for a personal memory app called Aether. Your job is to generate 2-4 highly relevant, specific hashtags based on the ACTUAL CONTENT of what the user saved.

CRITICAL RULES:
1. Tags MUST reflect the SPECIFIC TOPICS and SUBJECT MATTER of the content
2. NEVER use generic placeholder tags — they are FORBIDDEN:
   - FORBIDDEN: #notes, #note, #memory, #thoughts, #thought, #capture, #misc, #general, #content, #stuff, #item, #entry
3. ALWAYS be specific and concrete:
   - Cafe visit → #cafe #food #places NOT #notes
   - Book recommendation → #books #reading NOT #notes
   - Startup idea → #startup #ideas NOT #thoughts
   - Meeting notes → #meeting #work NOT #notes
   - Recipe → #food #recipe #cooking NOT #notes
   - Travel plan → #travel #planning NOT #misc
4. Always include the # symbol
5. Return ONLY a JSON array of tag strings, nothing else`

  if (type === 'voice') {
    return `${baseRules}

ADDITIONAL VOICE RULES:
- This is a VOICE MEMORY that was transcribed from speech
- Tags MUST be based on what was ACTUALLY SAID in the transcription
- NEVER tag it #voice, #audio, #memo, or #recording — these are FORBIDDEN
- If someone talked about a meeting, use #meeting #work
- If someone described a recipe, use #food #recipe #cooking
- If someone shared an idea, use #idea plus the topic of the idea
- If someone discussed a person, use #people plus the context
- The summary provided gives the key points — use it to generate accurate tags`
  }

  if (type === 'image') {
    return `${baseRules}

ADDITIONAL IMAGE RULES:
- This is an IMAGE MEMORY
- An AI has already analyzed and described the image content
- Tags MUST be based on what is ACTUALLY IN the image as described
- NEVER tag it #image, #photo, #capture, or #picture — these are FORBIDDEN
- If the image shows food, use #food #restaurant #meal etc.
- If the image shows a document with text, use tags based on the text content
- If the image shows a place, use #travel #outdoors etc.
- If the image shows a product, use the product category
- If the image shows code, use #code #programming etc.`
  }

  if (type === 'link') {
    return `${baseRules}

ADDITIONAL LINK RULES:
- This is a SAVED LINK/BOOKMARK
- Tags should reflect the TOPIC of the linked content
- NEVER tag it #link, #bookmark, #saved, or #url — these are FORBIDDEN
- Extract the subject matter from the URL and any description provided`
  }

  return baseRules
}

export async function POST(req: NextRequest) {
  try {
    const { content, type, summary, imageDescription } = await req.json()

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const zai = await getZAI()

    const systemPrompt = buildSystemPrompt(type || 'text')

    // Build the user prompt with all available context
    let contextBlock = ''

    // For image memories, prioritize the AI-generated image description
    if (type === 'image' && imageDescription) {
      contextBlock = `Image content analysis: "${imageDescription}"

Original text: "${content.slice(0, 500)}"`
    } else if (type === 'voice' && summary) {
      // For voice memories, include the AI summary for richer context
      contextBlock = `Voice transcription: "${content.slice(0, 800)}"

AI Summary of what was said: "${summary}"`
    } else {
      contextBlock = `"${content.slice(0, 1000)}"`
    }

    const userPrompt = `Generate 2-4 highly specific, relevant tags for this ${type || 'text'} memory. Remember: NEVER use generic tags like #notes, #memory, #voice, #image, #capture. Only use tags that reflect the ACTUAL TOPIC and CONTENT.

${contextBlock}

Return only a JSON array of tag strings with # symbols. Example: ["#cafe", "#food", "#places"]`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const responseText = completion.choices[0]?.message?.content || ''

    // Parse the JSON array from the response
    let tags: string[] = []
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        tags = JSON.parse(jsonMatch[0])
      }
    } catch {
      const hashTags = responseText.match(/#\w+/g)
      if (hashTags) {
        tags = hashTags.slice(0, 4)
      }
    }

    // Filter out any generic tags that slipped through
    tags = tags.filter((t) => !isGenericTag(t))

    // If we filtered everything out, try to extract meaningful tags from content
    if (tags.length === 0) {
      // Last resort: use the LLM one more time with even more explicit instructions
      const fallbackTags = extractFallbackTags(content, type)
      tags = fallbackTags.length > 0 ? fallbackTags : ['#memory']
    }

    // Limit to 4 tags max
    tags = tags.slice(0, 4)

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Tag generation error:', error)
    return NextResponse.json({ tags: ['#memory'] })
  }
}

// Simple keyword-based fallback tag extraction
function extractFallbackTags(content: string, type: string): string[] {
  const lower = content.toLowerCase()
  const tags: string[] = []

  const topicMap: Record<string, string[]> = {
    cafe: ['#cafe', '#food'],
    coffee: ['#coffee', '#food'],
    restaurant: ['#restaurant', '#food'],
    meeting: ['#meeting', '#work'],
    project: ['#project', '#work'],
    code: ['#code', '#programming'],
    programming: ['#programming', '#code'],
    book: ['#books', '#reading'],
    recipe: ['#recipe', '#food', '#cooking'],
    travel: ['#travel'],
    idea: ['#idea'],
    workout: ['#fitness', '#health'],
    gym: ['#fitness', '#health'],
    movie: ['#movies'],
    music: ['#music'],
    shopping: ['#shopping'],
    budget: ['#finance'],
    money: ['#finance'],
    doctor: ['#health'],
    recipe: ['#food', '#cooking'],
    family: ['#family'],
    friend: ['#social'],
    party: ['#social'],
  }

  for (const [keyword, tagList] of Object.entries(topicMap)) {
    if (lower.includes(keyword) && tags.length < 4) {
      for (const tag of tagList) {
        if (!tags.includes(tag) && tags.length < 4) {
          tags.push(tag)
        }
      }
    }
  }

  if (tags.length === 0) {
    tags.push('#memory')
  }

  return tags
}

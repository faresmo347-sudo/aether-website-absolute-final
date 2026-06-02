import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'
import { AETHER_MASTER_PROMPT } from '@/lib/aether-prompt'

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

export async function POST(req: NextRequest) {
  try {
    const { content, type, summary, imageDescription } = await req.json()

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Build the user prompt with all available context
    let contextBlock = ''

    if (type === 'image' && imageDescription) {
      contextBlock = `Image content analysis: "${imageDescription}"

Original text: "${content.slice(0, 500)}"`
    } else if (type === 'voice' && summary) {
      contextBlock = `Voice transcription: "${content.slice(0, 800)}"

AI Summary of what was said: "${summary}"`
    } else {
      contextBlock = `"${content.slice(0, 1000)}"`
    }

    // Type-specific tagging rules
    let typeRules = ''
    if (type === 'voice') {
      typeRules = `
ADDITIONAL VOICE RULES:
- This is a VOICE MEMORY that was transcribed from speech
- Tags MUST be based on what was ACTUALLY SAID in the transcription
- NEVER tag it #voice, #audio, #memo, or #recording — these are FORBIDDEN
- If someone talked about a meeting, use #meeting #work
- If someone described a recipe, use #food #recipe #cooking
- If someone shared an idea, use #idea plus the topic of the idea`
    } else if (type === 'image') {
      typeRules = `
ADDITIONAL IMAGE RULES:
- This is an IMAGE MEMORY
- Tags MUST be based on what is ACTUALLY IN the image as described
- NEVER tag it #image, #photo, #capture, or #picture — these are FORBIDDEN
- If the image shows food, use #food #restaurant #meal etc.
- If the image shows a document with text, use tags based on the text content
- If the image shows a place, use #travel #outdoors etc.`
    } else if (type === 'link') {
      typeRules = `
ADDITIONAL LINK RULES:
- This is a SAVED LINK/BOOKMARK
- Tags should reflect the TOPIC of the linked content
- NEVER tag it #link, #bookmark, #saved, or #url — these are FORBIDDEN
- Extract the subject matter from the URL and any description provided`
    }

    const userPrompt = `Generate 2-4 highly specific, relevant tags for this ${type || 'text'} memory as Aether. This is a ${(type || 'text').toUpperCase()} memory. Process it accordingly. Remember: NEVER use generic tags like #notes, #memory, #voice, #image, #capture. Only use tags that reflect the ACTUAL TOPIC and CONTENT. Think: "What would this person search for in 6 months to find this memory?"
${typeRules}

${contextBlock}

Return only a JSON array of tag strings with # symbols. Example: ["#cafe", "#food", "#places"]`

    const responseText = await callAI(AETHER_MASTER_PROMPT, userPrompt, 0.6, 150)

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
      const fallbackTags = extractFallbackTags(content, type)
      tags = fallbackTags.length > 0 ? fallbackTags : ['#memory']
    }

    // Limit to 4 tags max
    tags = tags.slice(0, 4)

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Tag generation error:', error)

    // If all providers exhausted, fail silently — memory still saves without AI tags
    if (error instanceof Error && error.message === 'ALL_PROVIDERS_EXHAUSTED') {
      return NextResponse.json({ tags: [] })
    }

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

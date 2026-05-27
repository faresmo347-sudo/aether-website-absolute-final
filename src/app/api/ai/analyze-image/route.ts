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
    const { image } = await req.json()

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Image base64 is required' }, { status: 400 })
    }

    const zai = await getZAI()

    // Build the data URL for the VLM
    // The client may send raw base64 or a data URL; normalize it
    const imageUrl = image.startsWith('data:')
      ? image
      : `data:image/jpeg;base64,${image}`

    // Use VLM to analyze the image content and generate a description + tags
    const vlmResponse = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image carefully for a personal memory app called Aether. Your response must be a JSON object with exactly these fields:

1. "description": A clear, detailed 1-3 sentence description of what is in this image. If there is text in the image, include the key text content. If it's a photo, describe the subject, setting, and any notable details. If it's a screenshot, describe what the screenshot shows.

2. "tags": An array of 2-4 highly specific, relevant hashtags that reflect what is ACTUALLY in the image. Rules for tags:
   - A food photo gets tags like #food #restaurant #meal
   - A screenshot of code gets #code #programming #screenshot
   - A document/photo of text gets tags based on the content of that text
   - A photo of a place gets #travel #location-name or #outdoors #nature
   - A product photo gets the product category like #electronics #gadgets
   - A photo of people gets #people #social #friends etc.
   - NEVER use generic tags like #image, #photo, #capture, #picture unless the image is completely unidentifiable
   - Always include the # symbol in each tag

Return ONLY the JSON object, no other text. Example: {"description": "A plate of pasta at an Italian restaurant with fresh basil on top", "tags": ["#food", "#italian", "#restaurant"]}`,
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const responseText = vlmResponse.choices[0]?.message?.content || ''

    // Parse the JSON response
    let description = ''
    let tags: string[] = []

    try {
      // Try to extract JSON from the response (may have markdown wrapping)
      const jsonMatch = responseText.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        description = parsed.description || ''
        tags = parsed.tags || []
      }
    } catch {
      // Fallback: extract hashtags from text
      const hashTags = responseText.match(/#\w+/g)
      if (hashTags) {
        tags = hashTags.slice(0, 4)
      }
      description = responseText.replace(/#\w+/g, '').trim().slice(0, 200)
    }

    if (!description) {
      description = 'Image captured'
    }

    if (tags.length === 0) {
      tags = ['#image']
    }

    return NextResponse.json({ description, tags })
  } catch (error) {
    console.error('Image analysis error:', error)
    return NextResponse.json(
      { description: 'Image captured', tags: ['#image'] },
      { status: 200 }
    )
  }
}

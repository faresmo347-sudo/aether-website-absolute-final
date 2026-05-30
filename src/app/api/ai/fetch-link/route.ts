import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json() as { url: string }

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(emptyResult(), { status: 200 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(emptyResult(), { status: 200 })
    }

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(emptyResult(), { status: 200 })
    }

    // Fetch with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    let html = ''
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Aether/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      })

      // Only process HTML responses
      const contentType = response.headers.get('content-type') || ''
      if (
        contentType.includes('text/html') ||
        contentType.includes('application/xhtml') ||
        contentType.includes('text/plain')
      ) {
        html = await response.text()
      } else {
        // Non-HTML response (PDF, image, etc.) — return what we can
        return NextResponse.json({
          title: parsedUrl.hostname,
          description: '',
          content: `File from ${parsedUrl.hostname}`,
          siteName: parsedUrl.hostname.replace(/^www\./, ''),
          image: '',
          success: true,
        })
      }
    } catch {
      // Fetch failed (timeout, network error, blocked, etc.)
      return NextResponse.json(emptyResult(), { status: 200 })
    } finally {
      clearTimeout(timeout)
    }

    if (!html) {
      return NextResponse.json(emptyResult(), { status: 200 })
    }

    // Extract metadata from HTML using pure string manipulation and regex
    const title = extractTitle(html) || parsedUrl.hostname
    const description = extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description') || ''
    const siteName = extractMetaContent(html, 'og:site_name') || parsedUrl.hostname.replace(/^www\./, '')
    const image = extractMetaContent(html, 'og:image') || ''
    const content = extractBodyText(html)

    return NextResponse.json({
      title,
      description,
      content,
      siteName,
      image,
      success: true,
    })
  } catch {
    // Never throw — always return a response
    return NextResponse.json(emptyResult(), { status: 200 })
  }
}

function emptyResult() {
  return {
    title: '',
    description: '',
    content: '',
    siteName: '',
    image: '',
    success: false,
  }
}

/**
 * Extract the page title. Prefer og:title, then <title> tag.
 */
function extractTitle(html: string): string {
  // Try og:title first
  const ogTitle = extractMetaContent(html, 'og:title')
  if (ogTitle) return decodeHtmlEntities(ogTitle)

  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch && titleMatch[1]) {
    return decodeHtmlEntities(titleMatch[1].trim())
  }

  return ''
}

/**
 * Extract meta tag content by name or property.
 * Handles both: <meta property="og:title" content="..."> and <meta name="description" content="...">
 */
function extractMetaContent(html: string, nameOrProperty: string): string {
  // Try property= first (for og: tags)
  const propertyPattern = new RegExp(
    `<meta[^>]*property\\s*=\\s*["']${escapeRegex(nameOrProperty)}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    'i'
  )
  const propertyMatch = html.match(propertyPattern)
  if (propertyMatch && propertyMatch[1]) {
    return decodeHtmlEntities(propertyMatch[1].trim())
  }

  // Also try content before property (some pages have reversed attribute order)
  const propertyPatternReversed = new RegExp(
    `<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*property\\s*=\\s*["']${escapeRegex(nameOrProperty)}["']`,
    'i'
  )
  const propertyMatchReversed = html.match(propertyPatternReversed)
  if (propertyMatchReversed && propertyMatchReversed[1]) {
    return decodeHtmlEntities(propertyMatchReversed[1].trim())
  }

  // Try name= (for standard meta tags like description)
  const namePattern = new RegExp(
    `<meta[^>]*name\\s*=\\s*["']${escapeRegex(nameOrProperty)}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    'i'
  )
  const nameMatch = html.match(namePattern)
  if (nameMatch && nameMatch[1]) {
    return decodeHtmlEntities(nameMatch[1].trim())
  }

  // Reversed order for name
  const namePatternReversed = new RegExp(
    `<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*name\\s*=\\s*["']${escapeRegex(nameOrProperty)}["']`,
    'i'
  )
  const nameMatchReversed = html.match(namePatternReversed)
  if (nameMatchReversed && nameMatchReversed[1]) {
    return decodeHtmlEntities(nameMatchReversed[1].trim())
  }

  return ''
}

/**
 * Extract the readable body text from HTML.
 * Strips scripts, styles, nav, footer, header, and all HTML tags.
 * Returns up to 3000 characters of clean text.
 */
function extractBodyText(html: string): string {
  let text = html

  // Remove comments
  text = text.replace(/<!--[\s\S]*?-->/g, '')

  // Remove script tags and their content
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')

  // Remove style tags and their content
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')

  // Remove noscript tags
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '')

  // Remove non-content elements (nav, footer, header, aside, form, iframe)
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '')
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '')
  text = text.replace(/<aside[\s\S]*?<\/aside>/gi, '')
  text = text.replace(/<form[\s\S]*?<\/form>/gi, '')
  text = text.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')

  // Try to extract content from <main>, <article>, or <body> first for better quality
  let mainContent = ''

  // Try <main> tag
  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch) {
    mainContent = mainMatch[1]
  }

  // Try <article> tag
  if (!mainContent) {
    const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    if (articleMatch) {
      mainContent = articleMatch[1]
    }
  }

  // Fall back to <body>
  if (!mainContent) {
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyMatch) {
      mainContent = bodyMatch[1]
    } else {
      mainContent = text
    }
  }

  // Remove all remaining HTML tags
  mainContent = mainContent.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  mainContent = decodeHtmlEntities(mainContent)

  // Normalize whitespace
  mainContent = mainContent
    .replace(/\t/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \s]+/g, ' ')
    .trim()

  // Remove common ad/text patterns
  mainContent = mainContent.replace(/cookie\s*(policy|preferences|settings|notice|consent)/gi, '')
  mainContent = mainContent.replace(/subscribe\s*(to\s*our\s*)?newsletter/gi, '')
  mainContent = mainContent.replace(/sign\s*up\s*(for\s*our\s*)?newsletter/gi, '')

  // Trim to 3000 characters at the last complete sentence/word
  if (mainContent.length > 3000) {
    mainContent = mainContent.substring(0, 3000)
    // Try to end at the last sentence
    const lastPeriod = mainContent.lastIndexOf('.')
    const lastQuestion = mainContent.lastIndexOf('?')
    const lastExclaim = mainContent.lastIndexOf('!')
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim)
    if (lastSentenceEnd > 2500) {
      mainContent = mainContent.substring(0, lastSentenceEnd + 1)
    } else {
      // Fall back to last word boundary
      const lastSpace = mainContent.lastIndexOf(' ')
      if (lastSpace > 2500) {
        mainContent = mainContent.substring(0, lastSpace)
      }
    }
  }

  return mainContent.trim()
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

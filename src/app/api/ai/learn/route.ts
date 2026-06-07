/**
 * ═══════════════════════════════════════════════════════════
 * AETHER LEARN ROUTE — Extracts personal facts from conversations
 * ═══════════════════════════════════════════════════════════
 *
 * IMPORTANT: Before using this route, you MUST run the following SQL
 * migration in your Supabase dashboard (SQL Editor):
 *
 * CREATE TABLE user_profiles (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
 *   display_name text,
 *   learned_facts jsonb DEFAULT '[]'::jsonb,
 *   personality_notes text,
 *   last_updated timestamptz DEFAULT now(),
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can manage own profile"
 * ON user_profiles FOR ALL
 * USING (auth.uid() = user_id)
 * WITH CHECK (auth.uid() = user_id);
 *
 * This route is called fire-and-forget from the ask route.
 * It never blocks the AI response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface LearnRequest {
  userId: string
  userMessage: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
}

interface LearnedFact {
  fact: string
  category: string
  confidence: 'high' | 'medium' | 'low'
  learned_at: string
}

export async function POST(req: NextRequest) {
  try {
    const { userId, userMessage, conversationHistory } = (await req.json()) as LearnRequest

    if (!userId || !userMessage) {
      return NextResponse.json({ success: false }, { status: 400 })
    }

    // Skip learning for very short messages (greetings, etc.)
    if (userMessage.trim().length < 5) {
      return NextResponse.json({ success: true, learned: false })
    }

    // Extract facts from conversation using AI
    const conversationText = conversationHistory
      .slice(-6)
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Aether'}: ${msg.content}`)
      .join('\n')

    const learnPrompt = `Analyze this conversation and extract any personal facts you learned about the user. Only extract concrete facts — name, age, location, job, hobbies, preferences, goals, relationships, struggles. Do not extract vague impressions.

Conversation:
User: ${userMessage}
${conversationText}

Return ONLY a JSON array:
[
  {
    "fact": "specific fact about the user",
    "category": "personal|hobby|goal|preference|relationship|location|work",
    "confidence": "high|medium|low"
  }
]

Return empty array [] if nothing concrete was learned. Never make assumptions.`

    const responseText = await callAI(
      'You are a fact extraction engine. You ONLY return JSON arrays. No explanation, no markdown, just the raw JSON array.',
      learnPrompt,
      0.2,
      500
    )

    // Parse the facts
    let newFacts: Array<{ fact: string; category: string; confidence: string }> = []
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed)) {
          newFacts = parsed.filter(
            (f: any) => f.fact && typeof f.fact === 'string' && f.fact.length > 3
          )
        }
      }
    } catch {
      // Could not parse — skip this learning round
      return NextResponse.json({ success: true, learned: false })
    }

    if (newFacts.length === 0) {
      return NextResponse.json({ success: true, learned: false })
    }

    // Format new facts with metadata
    const now = new Date().toISOString()
    const formattedNewFacts: LearnedFact[] = newFacts.map((f) => ({
      fact: f.fact,
      category: f.category || 'personal',
      confidence: (['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium') as 'high' | 'medium' | 'low',
      learned_at: now,
    }))

    // Update user profile in Supabase
    const supabase = await createServerSupabaseClient()

    // Fetch existing profile
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('learned_facts, personality_notes, display_name')
      .eq('user_id', userId)
      .single()

    const existingFacts: LearnedFact[] = (existingProfile?.learned_facts as LearnedFact[]) || []

    // Merge new facts with existing — remove duplicates
    const mergedFacts = [...existingFacts]

    for (const newFact of formattedNewFacts) {
      // Check for similar existing facts (same category and similar content)
      const isDuplicate = mergedFacts.some(
        (existing) =>
          existing.category === newFact.category &&
          (existing.fact.toLowerCase().includes(newFact.fact.toLowerCase().slice(0, 20)) ||
            newFact.fact.toLowerCase().includes(existing.fact.toLowerCase().slice(0, 20)))
      )

      if (!isDuplicate) {
        mergedFacts.push(newFact)
      } else {
        // Update the existing fact if the new one has higher confidence
        const existingIdx = mergedFacts.findIndex(
          (existing) =>
            existing.category === newFact.category &&
            existing.fact.toLowerCase().includes(newFact.fact.toLowerCase().slice(0, 20))
        )
        if (existingIdx !== -1 && newFact.confidence === 'high') {
          mergedFacts[existingIdx] = newFact
        }
      }
    }

    // Keep maximum 50 facts — remove oldest low confidence facts when over limit
    let finalFacts = mergedFacts
    if (finalFacts.length > 50) {
      // Sort by confidence (high first) then by date (newest first)
      const confidenceOrder = { high: 0, medium: 1, low: 2 }
      finalFacts.sort((a, b) => {
        const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
        if (confDiff !== 0) return confDiff
        return new Date(b.learned_at).getTime() - new Date(a.learned_at).getTime()
      })
      finalFacts = finalFacts.slice(0, 50)
    }

    // Extract display_name if a name fact was learned
    let displayName = existingProfile?.display_name || ''
    const nameFact = formattedNewFacts.find(
      (f) =>
        f.category === 'personal' &&
        (f.fact.toLowerCase().includes('name is') ||
          f.fact.toLowerCase().includes('named') ||
          f.fact.toLowerCase().includes("name's") ||
          f.fact.toLowerCase().includes('called'))
    )
    if (nameFact && !displayName) {
      // Extract name from fact like "His name is Fares" or "User's name is Fares"
      const nameMatch = nameFact.fact.match(/(?:name is|named|called)\s+(\w+)/i)
      if (nameMatch) {
        displayName = nameMatch[1]
      }
    }

    // Generate personality notes summary
    let personalityNotes = ''
    if (finalFacts.length > 0) {
      const factSummary = finalFacts
        .slice(0, 15)
        .map((f) => f.fact)
        .join('; ')
      try {
        const summaryPrompt = `Based on these facts about a person, write a 2-3 sentence summary of who they are. Be warm but concise. Facts: ${factSummary}`
        personalityNotes = await callAI(
          'You write concise personality summaries. 2-3 sentences max.',
          summaryPrompt,
          0.3,
          200
        )
      } catch {
        // Summary generation failed — use a simple fallback
        personalityNotes = `A person with interests in ${finalFacts
          .slice(0, 5)
          .map((f) => f.category)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ')}.`
      }
    }

    // Upsert the profile
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: userId,
          display_name: displayName || existingProfile?.display_name || null,
          learned_facts: finalFacts,
          personality_notes: personalityNotes || existingProfile?.personality_notes || null,
          last_updated: now,
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('[Aether Learn] Supabase upsert error:', error)
      return NextResponse.json({ success: false }, { status: 500 })
    }

    return NextResponse.json({ success: true, learned: true, factsCount: formattedNewFacts.length })
  } catch (error) {
    console.error('[Aether Learn] Error:', error)
    // Never throw — this is fire-and-forget
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

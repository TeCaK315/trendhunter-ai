// src/app/api/block0/context/route.ts
// Блок 0 — Market Context Engine
// Генерирует Context Object для ниши: pain_hierarchy, signal_vocabulary, actors
// Кэшируется в Supabase с TTL по maturity_level

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSupabase } from '@/lib/supabase'
import { createHash } from 'crypto'

const claude = new Anthropic()

// TTL в днях по maturity_level
const TTL_DAYS: Record<string, number> = {
  emerging: 7,
  growing: 30,
  saturated: 90,
  declining: 14,
  unknown: 14,
}

// ── Types ────────────────────────────────────────────────────

interface MarketIdentity {
  canonical_name: string
  maturity_level: 'emerging' | 'growing' | 'saturated' | 'declining' | 'unknown'
  primary_language: string
  b2b_b2c: 'b2b' | 'b2c' | 'mixed'
}

interface PainHierarchy {
  existential: string[]
  operational: string[]
  cosmetic: string[]
  false: string[]
}

interface SignalVocabulary {
  real_pain_signals: string[]
  false_signals: string[]
  buying_intent_signals: string[]
}

interface Actors {
  economic_buyer: string
  end_user: string
  influencer: string
}

interface ContextObject {
  market_identity: MarketIdentity
  pain_hierarchy: PainHierarchy
  signal_vocabulary: SignalVocabulary
  actors: Actors
  stop_words_contextual: string[]
  system_confidence: {
    confidence_score: number
    confidence_reason: string
  }
}

// ── Helpers ──────────────────────────────────────────────────

function nicheHash(niche: string): string {
  return createHash('sha256').update(niche.toLowerCase().trim()).digest('hex')
}

const PROMPT_VERSION = '1.0'

// ── Route ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const niche = (body.niche || '').trim()

    if (!niche) {
      return NextResponse.json({ error: 'niche is required' }, { status: 400 })
    }

    const hash = nicheHash(niche)
    const supabase = getServerSupabase()

    // ── Check cache ────────────────────────────────────────
    const { data: cached, error: cacheErr } = await supabase
      .from('context_objects')
      .select('id, context_object, niche_canonical, confidence_score')
      .eq('niche_hash', hash)
      .eq('prompt_version', PROMPT_VERSION)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (cached && !cacheErr) {
      // Update hit_count + last_used_at (fire-and-forget)
      supabase
        .from('context_objects')
        .update({
          hit_count: (cached as any).hit_count ? (cached as any).hit_count + 1 : 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', cached.id)
        .then(() => {})

      return NextResponse.json({
        context_object: cached.context_object,
        niche_canonical: cached.niche_canonical,
        confidence_score: cached.confidence_score,
        from_cache: true,
      })
    }

    // ── Generate via Sonnet ────────────────────────────────
    console.log(`[Block0] Generating context for: "${niche}"`)

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a market research expert. Analyze the niche: "${niche}"

Return a JSON object with exactly this structure:
{
  "market_identity": {
    "canonical_name": "standardized English name",
    "maturity_level": "emerging|growing|saturated|declining|unknown",
    "primary_language": "en|ru|de|...",
    "b2b_b2c": "b2b|b2c|mixed"
  },
  "pain_hierarchy": {
    "existential": ["top 5 pains that make businesses fail or lose major revenue"],
    "operational": ["top 5 daily friction points that slow teams down"],
    "cosmetic": ["top 3 minor annoyances, nice-to-have improvements"],
    "false": ["top 3 complaints that sound like pain but aren't real business problems"]
  },
  "signal_vocabulary": {
    "real_pain_signals": ["exact phrases users say when they have real pain"],
    "false_signals": ["phrases that sound like pain but indicate satisfaction or noise"],
    "buying_intent_signals": ["phrases indicating readiness to pay for solution"]
  },
  "actors": {
    "economic_buyer": "who signs the check and their top concern",
    "end_user": "who uses the product daily and their top frustration",
    "influencer": "who influences the buying decision"
  },
  "stop_words_contextual": ["niche-specific words that indicate irrelevant posts"],
  "system_confidence": {
    "confidence_score": 0.0-1.0,
    "confidence_reason": "why this score"
  }
}

Return ONLY valid JSON. No explanation.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse Context Object from Sonnet response')
    }

    const contextObject: ContextObject = JSON.parse(jsonMatch[0])
    const maturity = contextObject.market_identity?.maturity_level || 'unknown'
    const ttlDays = TTL_DAYS[maturity] || 14
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + ttlDays)

    // ── Save to Supabase ─────────────────────────────────
    const { error: insertErr } = await supabase
      .from('context_objects')
      .upsert(
        {
          niche_hash: hash,
          niche_input: niche,
          niche_canonical: contextObject.market_identity?.canonical_name || niche,
          context_object: contextObject,
          confidence_score: contextObject.system_confidence?.confidence_score ?? null,
          prompt_version: PROMPT_VERSION,
          expires_at: expiresAt.toISOString(),
          hit_count: 0,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'niche_hash' }
      )

    if (insertErr) {
      console.error('[Block0] Supabase insert error:', insertErr.message)
      // Non-fatal — still return the generated object
    }

    console.log(`[Block0] Generated context for "${niche}" (maturity=${maturity}, TTL=${ttlDays}d, confidence=${contextObject.system_confidence?.confidence_score})`)

    return NextResponse.json({
      context_object: contextObject,
      niche_canonical: contextObject.market_identity?.canonical_name || niche,
      confidence_score: contextObject.system_confidence?.confidence_score ?? null,
      from_cache: false,
    })
  } catch (error: any) {
    console.error('[Block0] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

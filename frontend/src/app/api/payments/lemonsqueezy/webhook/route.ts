import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getServerSupabase } from '@/lib/supabase'

// Пакеты монет — variant_id из Lemon Squeezy → количество монет
const CREDIT_PACKAGES: Record<string, number> = {
  [process.env.LS_VARIANT_5K  ?? '']: 5000,
  [process.env.LS_VARIANT_15K ?? '']: 15000,
  [process.env.LS_VARIANT_50K ?? '']: 50000,
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature') ?? ''
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''

  // Верификация подписи
  const hmac = createHmac('sha256', secret)
  hmac.update(rawBody)
  const digest = hmac.digest('hex')

  if (digest !== signature) {
    console.error('[LS Webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const eventName = payload.meta?.event_name

  // Обрабатываем только успешные заказы
  if (eventName !== 'order_created') {
    return NextResponse.json({ received: true })
  }

  const order = payload.data?.attributes
  if (order?.status !== 'paid') {
    return NextResponse.json({ received: true })
  }

  // Достаём user_id из custom data
  const userId = payload.meta?.custom_data?.user_id
  if (!userId) {
    console.error('[LS Webhook] No user_id in custom_data')
    return NextResponse.json({ error: 'No user_id' }, { status: 400 })
  }

  // Определяем сколько монет начислить
  const variantId = String(payload.data?.attributes?.first_order_item?.variant_id ?? '')
  const credits = CREDIT_PACKAGES[variantId]
  if (!credits) {
    console.error('[LS Webhook] Unknown variant_id:', variantId)
    return NextResponse.json({ error: 'Unknown variant' }, { status: 400 })
  }

  const supabase = getServerSupabase()

  // Проверяем что этот order_id ещё не обрабатывали (idempotency)
  const orderId = String(payload.data?.id ?? '')
  const { data: existing } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('description', `lemonsqueezy_order_${orderId}`)
    .maybeSingle()

  if (existing) {
    console.log('[LS Webhook] Order already processed:', orderId)
    return NextResponse.json({ received: true })
  }

  // Начисляем монеты
  const { data: creditsRow } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single()

  const currentBalance = creditsRow?.balance ?? 0
  const newBalance = currentBalance + credits

  await supabase
    .from('user_credits')
    .upsert({ user_id: userId, balance: newBalance })
    .eq('user_id', userId)

  // Записываем транзакцию
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount: credits,
    type: 'purchase',
    description: `lemonsqueezy_order_${orderId}`,
  })

  console.log(`[LS Webhook] Credited ${credits} to user ${userId.slice(0,8)}`)
  return NextResponse.json({ received: true, credits_added: credits })
}
